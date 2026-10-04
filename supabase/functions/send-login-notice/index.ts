import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const appOrigins = new Set((Deno.env.get('APP_ORIGIN') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean))
const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin ?? 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
})

Deno.serve(async (request) => {
  const requestOrigin = request.headers.get('Origin')
  const responseOrigin = requestOrigin && appOrigins.has(requestOrigin) ? requestOrigin : null
  const respond = (body: Record<string, string | boolean>, status = 200) =>
    jsonResponse(body, status, responseOrigin)
  if (appOrigins.size === 0) {
    return respond({ error: 'Login email service is not configured.' }, 503)
  }
  if (requestOrigin && !appOrigins.has(requestOrigin)) {
    return respond({ error: 'Origin is not allowed.' }, 403)
  }
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(responseOrigin) })
  }
  if (request.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, 405)
  }

  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey || !fromEmail) {
    return respond({ error: 'Login email service is not configured.' }, 503)
  }

  const authenticatedClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const jwt = authorization.replace(/^Bearer\s+/i, '')
  const { data: claimsData, error: claimsError } = await authenticatedClient.auth.getClaims(jwt)
  const claims = claimsData?.claims
  if (claimsError || typeof claims?.sub !== 'string' || typeof claims.email !== 'string') {
    return respond({ error: 'A valid signed-in account is required.' }, 401)
  }
  if (typeof claims.session_id !== 'string') {
    return respond({ error: 'The sign-in session could not be verified.' }, 400)
  }
  const issuedAt = Number(claims.iat)
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) {
    return respond({ error: 'The sign-in time could not be verified.' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: existingNotice, error: lookupError } = await adminClient
    .from('login_notices')
    .select('sent_at')
    .eq('user_id', claims.sub)
    .eq('session_id', claims.session_id)
    .maybeSingle()
  if (lookupError) return respond({ error: 'Could not verify the login notice state.' }, 500)
  if (existingNotice?.sent_at) return respond({ sent: true, duplicate: true })

  const { error: recordError } = await adminClient.from('login_notices').upsert(
    { user_id: claims.sub, session_id: claims.session_id },
    { onConflict: 'user_id,session_id', ignoreDuplicates: true },
  )
  if (recordError) return respond({ error: 'Could not record the sign-in notice.' }, 500)

  const claimTime = new Date()
  const claimExpiredBefore = new Date(claimTime.getTime() - 2 * 60 * 1000).toISOString()
  const { data: claim, error: claimError } = await adminClient
    .from('login_notices')
    .update({ claimed_at: claimTime.toISOString() })
    .eq('user_id', claims.sub)
    .eq('session_id', claims.session_id)
    .is('sent_at', null)
    .or(`claimed_at.is.null,claimed_at.lt.${claimExpiredBefore}`)
    .select('session_id')
    .maybeSingle()
  if (claimError) return respond({ error: 'Could not claim the sign-in notice.' }, 500)
  if (!claim) return respond({ sent: true, duplicate: true })

  const signedInAt = new Date(Number(claims.iat) * 1000).toUTCString()
  let emailResponse: Response
  try {
    emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: ['Bearer', resendApiKey].join(' '),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [claims.email],
        subject: 'New sign-in to Daymark',
        text: `Your Google account signed in to Daymark at ${signedInAt}.\n\nIf this was you, no action is needed. If you do not recognize this sign-in, secure your Google account.`,
      }),
    })
  } catch (error) {
    console.error('Could not reach Resend for the sign-in notice:', error)
    const { error: releaseError } = await adminClient.from('login_notices')
      .update({ claimed_at: null })
      .eq('user_id', claims.sub)
      .eq('session_id', claims.session_id)
    if (releaseError) console.error('Could not release the sign-in notice claim:', releaseError.message)
    return respond({ error: 'The sign-in email service could not be reached.' }, 502)
  }
  if (!emailResponse.ok) {
    console.error('Resend rejected the sign-in notice:', emailResponse.status)
    const { error: releaseError } = await adminClient.from('login_notices')
      .update({ claimed_at: null })
      .eq('user_id', claims.sub)
      .eq('session_id', claims.session_id)
    if (releaseError) console.error('Could not release the sign-in notice claim:', releaseError.message)
    return respond({ error: 'The sign-in email could not be sent.' }, 502)
  }

  const { error: updateError } = await adminClient
    .from('login_notices')
    .update({ sent_at: new Date().toISOString(), claimed_at: null })
    .eq('user_id', claims.sub)
    .eq('session_id', claims.session_id)
  if (updateError) return respond({ error: 'The sign-in email was sent but its status could not be recorded.' }, 500)
  return respond({ sent: true })
})

function jsonResponse(body: Record<string, string | boolean>, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}
