FROM node:24-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS development

COPY . .
RUN chown -R node:node /app
USER node

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--strictPort"]

FROM dependencies AS build

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
