import type { Task } from './taskTypes'
import { isTask, normalizeTask } from './taskStorage'
import { supabase, type Json } from './supabaseClient'

const tombstonesStorageKey = 'daymark.task-deletions.v1'

export interface TaskTombstone {
  id: string
  updatedAt: number
}

interface TaskRecord {
  id: string
  owner_id: string
  payload: Json | null
  updated_at: number
  is_deleted: boolean
}

export interface TaskSyncResult {
  tasks: Task[]
  deletedTasks: TaskTombstone[]
}

export function mergeTaskLists(
  localTasks: Task[],
  remoteTasks: Task[],
  localTombstones: TaskTombstone[],
  remoteDeletedTasks: TaskTombstone[],
): Task[] {
  const merged = new Map(remoteTasks.map((task) => [task.id, task]))
  const remoteDeletedById = new Map(remoteDeletedTasks.map((item) => [item.id, item]))
  const localDeletedById = new Map(localTombstones.map((item) => [item.id, item]))

  for (const task of localTasks) {
    const remote = merged.get(task.id)
    const remoteDelete = remoteDeletedById.get(task.id)
    const localDelete = localDeletedById.get(task.id)
    if (localDelete) {
      const remoteVersion = Math.max(remote?.updatedAt ?? remote?.createdAt ?? -1, remoteDelete?.updatedAt ?? -1)
      if (localDelete.updatedAt < remoteVersion && remote) continue
      merged.delete(task.id)
      continue
    }
    if (remoteDelete) {
      if ((task.updatedAt ?? task.createdAt) > remoteDelete.updatedAt) merged.set(task.id, task)
      else merged.delete(task.id)
      continue
    }
    if (!remote || (task.updatedAt ?? task.createdAt) > (remote.updatedAt ?? remote.createdAt)) {
      merged.set(task.id, task)
    }
  }

  for (const tombstone of localTombstones) {
    const remote = merged.get(tombstone.id)
    if (!remote || tombstone.updatedAt >= (remote.updatedAt ?? remote.createdAt)) merged.delete(tombstone.id)
  }

  return [...merged.values()].sort((a, b) => b.createdAt - a.createdAt)
}

let syncQueue = Promise.resolve()

export function readTaskTombstones(): TaskTombstone[] {
  const stored = localStorage.getItem(tombstonesStorageKey)
  if (!stored) return []

  const parsed: unknown = JSON.parse(stored)
  if (!Array.isArray(parsed) || !parsed.every(isTaskTombstone)) {
    throw new Error('Saved task sync data is invalid. It was left unchanged.')
  }
  return parsed
}

export function writeTaskTombstones(tombstones: TaskTombstone[]): boolean {
  try {
    localStorage.setItem(tombstonesStorageKey, JSON.stringify(tombstones))
    return true
  } catch {
    return false
  }
}

export function addTaskTombstones(ids: string[], updatedAt = Date.now()): TaskTombstone[] {
  const current = readTaskTombstones()
  const next = new Map(current.map((item) => [item.id, item]))
  ids.forEach((id) => {
    const previous = next.get(id)
    next.set(id, { id, updatedAt: Math.max(updatedAt, (previous?.updatedAt ?? -1) + 1) })
  })
  const result = [...next.values()]
  if (!writeTaskTombstones(result)) {
    throw new Error('Could not save pending task deletions on this device.')
  }
  return result
}

export function removeTaskTombstone(id: string): TaskTombstone[] {
  const result = readTaskTombstones().filter((item) => item.id !== id)
  if (!writeTaskTombstones(result)) {
    throw new Error('Could not update pending task deletions on this device.')
  }
  return result
}

export async function synchronizeTaskSet(
  ownerId: string,
  localTasks: Task[],
  localTombstones: TaskTombstone[],
): Promise<TaskSyncResult> {
  const result = syncQueue.then(() => synchronizeTaskSetNow(ownerId, localTasks, localTombstones))
  syncQueue = result.then(() => undefined, () => undefined)
  return result
}

export function taskFromRecord(record: Pick<TaskRecord, 'id' | 'payload' | 'updated_at' | 'is_deleted'>): Task | null {
  if (record.is_deleted) return null
  if (!record.payload || !isTask(record.payload)) {
    throw new Error(`Cloud task ${record.id} is invalid. No local tasks were changed.`)
  }
  return { ...normalizeTask(record.payload), updatedAt: record.updated_at }
}

export function clearLocalAccountTasks(): boolean {
  try {
    localStorage.removeItem('daymark.tasks.v1')
    localStorage.removeItem(tombstonesStorageKey)
    return true
  } catch {
    return false
  }
}

function synchronizeTaskSetNow(
  ownerId: string,
  localTasks: Task[],
  localTombstones: TaskTombstone[],
): Promise<TaskSyncResult> {
  if (!supabase) return Promise.reject(new Error('Cloud sync is not configured.'))

  return (async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, owner_id, payload, updated_at, is_deleted')
      .eq('owner_id', ownerId)
    if (error) throw error

    const remoteById = new Map(data.map((record) => [record.id, record]))
    const localById = new Map<string, TaskRecord>()

    localTasks.forEach((task) => {
      localById.set(task.id, {
        id: task.id,
        owner_id: ownerId,
        payload: task as unknown as Json,
        updated_at: task.updatedAt ?? task.createdAt,
        is_deleted: false,
      })
    })
    localTombstones.forEach((tombstone) => {
      localById.set(tombstone.id, {
        id: tombstone.id,
        owner_id: ownerId,
        payload: null,
        updated_at: tombstone.updatedAt,
        is_deleted: true,
      })
    })

    const winners = new Map<string, TaskRecord>()
    const localWins: TaskRecord[] = []
    for (const id of new Set([...localById.keys(), ...remoteById.keys()])) {
      const local = localById.get(id)
      const remote = remoteById.get(id)
      if (!local) {
        winners.set(id, remote!)
        continue
      }
      if (!remote || local.updated_at > remote.updated_at) {
        winners.set(id, local)
        localWins.push(local)
        continue
      }
      winners.set(id, remote)
    }

    if (localWins.length > 0) {
      const { error: upsertError } = await supabase.from('tasks').upsert(localWins, { onConflict: 'id' })
      if (upsertError) throw upsertError
    }

    const winnerRecords = [...winners.values()]
    const tasks = winnerRecords
      .filter((record) => !record.is_deleted)
      .map((record) => taskFromRecord(record))
      .filter((task): task is Task => task !== null)
      .sort((a, b) => b.createdAt - a.createdAt)
    const deletedTasks = winnerRecords
      .filter((record) => record.is_deleted)
      .map((record) => ({ id: record.id, updatedAt: record.updated_at }))
    return { tasks, deletedTasks }
  })()
}

function isTaskTombstone(value: unknown): value is TaskTombstone {
  if (!value || typeof value !== 'object') return false
  const tombstone = value as Partial<TaskTombstone>
  return typeof tombstone.id === 'string'
    && tombstone.id.length > 0
    && typeof tombstone.updatedAt === 'number'
    && Number.isFinite(tombstone.updatedAt)
}
