/**
 * Database layer for authentication
 * Redis JSON + Sets storage with inline client initialization
 */
import Redis from 'ioredis'
import events from 'events'
import { ENVIRONMENT } from './constant.js'

const { REDIS_HOST, REDIS_SENTINEL_PORT, REDIS_MASTER_NAME } = ENVIRONMENT
const USE_LOCAL_IO = process.env.DISABLE_IO === 'true'

// Connection state for health checks
export const connection_state = {
  online: false,
}

// In-memory storage for local/test mode
const json_store = new Map()
const string_store = new Map()
const set_store = new Map()

/**
 * Parse JSON path and get/set nested values
 * Only supports simple paths like '.' (root) and '.field' (top-level field)
 */
const get_nested = (obj, path) => {
  if (path === '.') return obj
  if (path.startsWith('.')) {
    const field = path.slice(1)
    return obj?.[field]
  }
  throw new Error(`Unsupported JSON path: ${path}`)
}

const set_nested = (obj, path, value) => {
  if (path === '.') return value
  if (path.startsWith('.')) {
    const field = path.slice(1)
    return { ...obj, [field]: value }
  }
  throw new Error(`Unsupported JSON path: ${path}`)
}

/**
 * Create local mock client for testing
 */
const create_local_client = () => ({
  call: async (command, ...args) => {
    const cmd = command.toUpperCase()

    if (cmd === 'JSON.SET') {
      const [key, path, value_str] = args
      const value = JSON.parse(value_str)
      const existing = json_store.get(key)
      const updated = existing ? set_nested(existing, path, value) : value
      json_store.set(key, updated)
      return 'OK'
    }

    if (cmd === 'JSON.GET') {
      const [key, path = '.'] = args
      const obj = json_store.get(key)
      if (!obj) return null
      const result = get_nested(obj, path)
      return result !== undefined ? JSON.stringify(result) : null
    }

    if (cmd === 'JSON.DEL') {
      const [key] = args
      const existed = json_store.has(key)
      json_store.delete(key)
      return existed ? 1 : 0
    }

    if (cmd === 'SADD') {
      const [key, ...members] = args
      const current_set = set_store.get(key) || new Set()
      const before_size = current_set.size
      members.forEach((m) => current_set.add(m))
      set_store.set(key, current_set)
      return current_set.size - before_size
    }

    if (cmd === 'SREM') {
      const [key, ...members] = args
      const current_set = set_store.get(key)
      if (!current_set) return 0
      let removed = 0
      members.forEach((m) => {
        if (current_set.delete(m)) removed++
      })
      return removed
    }

    if (cmd === 'SMEMBERS') {
      const [key] = args
      const current_set = set_store.get(key)
      return current_set ? Array.from(current_set) : []
    }

    throw new Error(`Unsupported Redis command: ${cmd}`)
  },

  sadd: async (key, ...members) => {
    const current_set = set_store.get(key) || new Set()
    const before_size = current_set.size
    members.forEach((m) => current_set.add(m))
    set_store.set(key, current_set)
    return current_set.size - before_size
  },

  srem: async (key, ...members) => {
    const current_set = set_store.get(key)
    if (!current_set) return 0
    let removed = 0
    members.forEach((m) => {
      if (current_set.delete(m)) removed++
    })
    return removed
  },

  smembers: async (key) => {
    const current_set = set_store.get(key)
    return current_set ? Array.from(current_set) : []
  },

  set: async (key, value) => {
    string_store.set(key, value)
    return 'OK'
  },

  get: async (key) => {
    return string_store.get(key) ?? null
  },

  del: async (...keys) => {
    let deleted = 0
    keys.forEach((key) => {
      if (string_store.delete(key)) deleted++
      if (json_store.delete(key)) deleted++
      if (set_store.delete(key)) deleted++
    })
    return deleted
  },

  publish: async () => 1,

  quit: async () => {
    json_store.clear()
    string_store.clear()
    set_store.clear()
  },

  on: () => {},
})

/**
 * Create Redis client (real or mock based on DISABLE_IO)
 */
const create_redis_client = async () => {
  if (USE_LOCAL_IO) {
    connection_state.online = true
    const local_client = create_local_client()
    return { master_client: local_client, slave_client: local_client }
  }

  /* c8 ignore next 10 */
  // not testing the retry strategy
  const retryStrategy = (label) => (attempt) => {
    console.warn(`[${label}] Unable to reach redis, retrying.. [${attempt}]`)
    if (attempt > 5) {
      connection_state.online = false
      return new Error(`Can't connect to redis after ${attempt} tries..`)
    }
    return 250 * 2 ** attempt
  }

  const USE_SENTINEL = process.env.REDIS_USE_SENTINEL === 'true'
  let master_client, slave_client

  if (USE_SENTINEL) {
    const sentinel_options = (role) => ({
      sentinels: [{ host: REDIS_HOST, port: REDIS_SENTINEL_PORT }],
      name: REDIS_MASTER_NAME,
      role,
      sentinelRetryStrategy: retryStrategy(role),
    })
    master_client = new Redis(sentinel_options('master'))
    slave_client = new Redis(sentinel_options('slave'))
  } else {
    const direct_options = {
      host: REDIS_HOST,
      port: 6379,
      retryStrategy: retryStrategy('redis'),
    }
    master_client = new Redis(direct_options)
    slave_client = master_client
  }

  await Promise.all([
    events.once(slave_client, 'ready'),
    events.once(master_client, 'ready'),
  ])

  new Set([master_client, slave_client]).forEach((client) => {
    client.on('error', () => {})
  })
  connection_state.online = true

  return { master_client, slave_client }
}

// Initialize clients at module load
const { master_client, slave_client } = await create_redis_client()
export { master_client, slave_client }

/**
 * User operations
 */
export const user_db = {
  /**
   * Create a new user
   * @param {Object} user - User object with uuid, mail, hash, etc.
   */
  create: async (user) => {
    await master_client.call(
      'JSON.SET',
      `user:${user.uuid}`,
      '.',
      JSON.stringify(user)
    )
    await master_client.set(`user:email:${user.mail}`, user.uuid)
  },

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Object|null} User object or null
   */
  find_by_email: async (email) => {
    const user_uuid = await master_client.get(`user:email:${email}`)
    if (!user_uuid) return null

    const user_json = await master_client.call('JSON.GET', `user:${user_uuid}`)
    return user_json ? JSON.parse(user_json) : null
  },

  /**
   * Find user by UUID
   * @param {string} uuid - User UUID
   * @returns {Object|null} User object or null
   */
  find_by_uuid: async (uuid) => {
    const user_json = await master_client.call('JSON.GET', `user:${uuid}`)
    return user_json ? JSON.parse(user_json) : null
  },

  /**
   * Update user fields
   * @param {string} uuid - User UUID
   * @param {Object} updates - Fields to update
   */
  update: async (uuid, updates) => {
    for (const [key, value] of Object.entries(updates)) {
      await master_client.call(
        'JSON.SET',
        `user:${uuid}`,
        `.${key}`,
        JSON.stringify(value)
      )
    }
  },

  /**
   * Delete user
   * @param {string} uuid - User UUID
   */
  delete: async (uuid) => {
    const user = await user_db.find_by_uuid(uuid)
    if (!user) return

    await session_db.delete_all_for_user(uuid)
    await master_client.del(`user:email:${user.mail}`)
    await master_client.call('JSON.DEL', `user:${uuid}`)
  },

  /**
   * Get all user sessions
   * @param {string} user_uuid - User UUID
   * @returns {Array} Array of session objects
   */
  get_sessions: async (user_uuid) => {
    const session_uuids = await master_client.smembers(
      `user:${user_uuid}:sessions`
    )
    if (!session_uuids || session_uuids.length === 0) return []

    const sessions = []
    for (const session_uuid of session_uuids) {
      const session = await session_db.find_by_uuid(session_uuid)
      if (session) sessions.push(session)
    }
    return sessions
  },
}

/**
 * Session operations
 */
export const session_db = {
  /**
   * Create a new session
   * @param {string} user_uuid - User UUID
   * @param {Object} session - Session object with uuid, ip, browserName, etc.
   */
  create: async (user_uuid, session) => {
    await master_client.call(
      'JSON.SET',
      `session:${session.uuid}`,
      '.',
      JSON.stringify(session)
    )
    await master_client.sadd(`user:${user_uuid}:sessions`, session.uuid)
  },

  /**
   * Find session by UUID
   * @param {string} uuid - Session UUID
   * @returns {Object|null} Session object or null
   */
  find_by_uuid: async (uuid) => {
    const session_json = await master_client.call('JSON.GET', `session:${uuid}`)
    return session_json ? JSON.parse(session_json) : null
  },

  /**
   * Update session fields
   * @param {string} uuid - Session UUID
   * @param {Object} updates - Fields to update
   */
  update: async (uuid, updates) => {
    for (const [key, value] of Object.entries(updates)) {
      await master_client.call(
        'JSON.SET',
        `session:${uuid}`,
        `.${key}`,
        JSON.stringify(value)
      )
    }
  },

  /**
   * Delete session
   * @param {string} user_uuid - User UUID
   * @param {string} session_uuid - Session UUID
   */
  delete: async (user_uuid, session_uuid) => {
    await master_client.srem(`user:${user_uuid}:sessions`, session_uuid)
    await master_client.call('JSON.DEL', `session:${session_uuid}`)
  },

  /**
   * Delete all sessions for a user
   * @param {string} user_uuid - User UUID
   */
  delete_all_for_user: async (user_uuid) => {
    const session_uuids = await master_client.smembers(
      `user:${user_uuid}:sessions`
    )
    if (!session_uuids || session_uuids.length === 0) return

    for (const session_uuid of session_uuids) {
      await master_client.call('JSON.DEL', `session:${session_uuid}`)
    }
    await master_client.del(`user:${user_uuid}:sessions`)
  },
}
