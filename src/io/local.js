/**
 * In-memory mock for Redis - matches ioredis interface
 * Used when DISABLE_IO=true for testing without Redis
 */

// Storage maps
const json_store = new Map() // For JSON.SET/GET/DEL
const string_store = new Map() // For SET/GET/DEL
const set_store = new Map() // For SADD/SREM/SMEMBERS
const ttl_store = new Map() // For SETEX tracking

const connection_state = {
  online: true,
}

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
 * Mock Redis client with call() method
 */
const create_client = () => ({
  /**
   * Generic call() method matching ioredis
   */
  call: async (command, ...args) => {
    const cmd = command.toUpperCase()

    // JSON commands
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

    // Set commands
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

  /**
   * Direct method calls (ioredis also supports these)
   */
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
      ttl_store.delete(key)
    })
    return deleted
  },

  setex: async (key, seconds, value) => {
    string_store.set(key, value)
    const timeout = setTimeout(() => {
      string_store.delete(key)
      ttl_store.delete(key)
    }, seconds * 1000)
    ttl_store.set(key, timeout)
    return 'OK'
  },

  getdel: async (key) => {
    const value = string_store.get(key)
    if (value !== undefined) {
      string_store.delete(key)
      const timeout = ttl_store.get(key)
      if (timeout) {
        clearTimeout(timeout)
        ttl_store.delete(key)
      }
    }
    return value ?? null
  },

  publish: async () => {
    // No-op for local mode (no pub/sub needed in tests)
    return 1
  },

  quit: async () => {
    // Cleanup
    json_store.clear()
    string_store.clear()
    set_store.clear()
    ttl_store.forEach((timeout) => clearTimeout(timeout))
    ttl_store.clear()
  },

  on: () => {
    // Event listener stub
  },
})

const shared_client = create_client()

export const master_client = shared_client
export const slave_client = shared_client // Same instance in local mode
export { connection_state }
