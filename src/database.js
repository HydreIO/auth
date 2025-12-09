/**
 * Database layer for authentication
 * FalkorDB graph database with Cypher queries
 */
import { FalkorDB } from 'falkordb'

import { ENVIRONMENT } from './constant.js'

const { REDIS_HOST } = ENVIRONMENT
const REDIS_PORT = process.env.REDIS_PORT ?? 6379
const GRAPH_NAME = process.env.GRAPH_NAME ?? 'auth'
const USE_LOCAL_IO = process.env.DISABLE_IO === 'true'

// Connection state for health checks
export const connection_state = {
  online: false,
}

// In-memory storage for local/test mode (simulates graph structure)
const users = new Map() // uuid -> user object
const sessions = new Map() // uuid -> session object
const user_sessions = new Map() // user_uuid -> Set of session_uuids
const email_index = new Map() // email -> user_uuid

/**
 * Create local mock for testing (simulates graph operations)
 */
const create_local_mock = () => {
  const clear_all = () => {
    users.clear()
    sessions.clear()
    user_sessions.clear()
    email_index.clear()
  }

  return {
    user: {
      create: async (user) => {
        users.set(user.uuid, { ...user })
        email_index.set(user.mail, user.uuid)
        user_sessions.set(user.uuid, new Set())
      },

      find_by_email: async (email) => {
        const user_uuid = email_index.get(email)
        if (!user_uuid) return null
        const user = users.get(user_uuid)
        return user ? { ...user } : null
      },

      find_by_uuid: async (uuid) => {
        const user = users.get(uuid)
        return user ? { ...user } : null
      },

      update: async (uuid, updates) => {
        const user = users.get(uuid)
        if (!user) return
        const old_email = user.mail
        Object.assign(user, updates)
        // Update email index if email changed
        if (updates.mail && updates.mail !== old_email) {
          email_index.delete(old_email)
          email_index.set(updates.mail, uuid)
        }
      },

      delete: async (uuid) => {
        const user = users.get(uuid)
        if (!user) return
        // Delete all user sessions
        const session_ids = user_sessions.get(uuid) ?? new Set()
        for (const session_uuid of session_ids) {
          sessions.delete(session_uuid)
        }
        user_sessions.delete(uuid)
        email_index.delete(user.mail)
        users.delete(uuid)
      },

      get_sessions: async (user_uuid) => {
        const session_ids = user_sessions.get(user_uuid) ?? new Set()
        return Array.from(session_ids)
          .map((id) => sessions.get(id))
          .filter(Boolean)
          .map((s) => ({ ...s }))
      },
    },

    session: {
      create: async (user_uuid, session) => {
        sessions.set(session.uuid, { ...session })
        const user_session_set = user_sessions.get(user_uuid) ?? new Set()
        user_session_set.add(session.uuid)
        user_sessions.set(user_uuid, user_session_set)
      },

      find_by_uuid: async (uuid) => {
        const session = sessions.get(uuid)
        return session ? { ...session } : null
      },

      update: async (uuid, updates) => {
        const session = sessions.get(uuid)
        if (!session) return
        Object.assign(session, updates)
      },

      delete: async (user_uuid, session_uuid) => {
        sessions.delete(session_uuid)
        const user_session_set = user_sessions.get(user_uuid)
        if (user_session_set) {
          user_session_set.delete(session_uuid)
        }
      },

      delete_all_for_user: async (user_uuid) => {
        const session_ids = user_sessions.get(user_uuid) ?? new Set()
        for (const session_uuid of session_ids) {
          sessions.delete(session_uuid)
        }
        user_sessions.set(user_uuid, new Set())
      },
    },

    clear: clear_all,
  }
}

/**
 * Create FalkorDB graph client
 */
const create_graph_client = async () => {
  /* c8 ignore start */
  const db = await FalkorDB.connect({
    socket: { host: REDIS_HOST, port: +REDIS_PORT },
  })
  const graph = db.selectGraph(GRAPH_NAME)

  // Create indexes (idempotent)
  try {
    await graph.query('CREATE INDEX FOR (u:User) ON (u.mail)')
  } catch {
    /* index exists */
  }
  try {
    await graph.query('CREATE INDEX FOR (u:User) ON (u.uuid)')
  } catch {
    /* index exists */
  }
  try {
    await graph.query('CREATE INDEX FOR (s:Session) ON (s.uuid)')
  } catch {
    /* index exists */
  }

  return graph
  /* c8 ignore stop */
}

/**
 * Extract node properties from query result
 */
const extract_node = (result, alias) => {
  const { data } = result ?? {}
  if (!data || data.length === 0) return null
  const [row] = data
  return row?.[alias] ?? null
}

/**
 * Extract multiple nodes from query result
 */
const extract_nodes = (result, alias) => {
  const { data } = result ?? {}
  if (!data || data.length === 0) return []
  return data.map((row) => row?.[alias]).filter(Boolean)
}

// Initialize based on mode
let graph = null
let local_mock = null

if (USE_LOCAL_IO) {
  local_mock = create_local_mock()
  connection_state.online = true
} else {
  /* c8 ignore next 2 */
  graph = await create_graph_client()
  connection_state.online = true
}

/**
 * User operations
 */
export const user_db = {
  /**
   * Create a new user
   * @param {Object} user - User object with uuid, mail, hash, etc.
   */
  create: async (user) => {
    if (USE_LOCAL_IO) {
      return local_mock.user.create(user)
    }
    /* c8 ignore next 3 */
    await graph.query('CREATE (u:User $props) RETURN u', {
      params: { props: user },
    })
  },

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Object|null} User object or null
   */
  find_by_email: async (email) => {
    if (USE_LOCAL_IO) {
      return local_mock.user.find_by_email(email)
    }
    /* c8 ignore next 5 */
    const result = await graph.query(
      'MATCH (u:User) WHERE u.mail = $mail RETURN u LIMIT 1',
      { params: { mail: email } }
    )
    return extract_node(result, 'u')
  },

  /**
   * Find user by UUID
   * @param {string} uuid - User UUID
   * @returns {Object|null} User object or null
   */
  find_by_uuid: async (uuid) => {
    if (USE_LOCAL_IO) {
      return local_mock.user.find_by_uuid(uuid)
    }
    /* c8 ignore next 5 */
    const result = await graph.query(
      'MATCH (u:User) WHERE u.uuid = $uuid RETURN u LIMIT 1',
      { params: { uuid } }
    )
    return extract_node(result, 'u')
  },

  /**
   * Update user fields
   * @param {string} uuid - User UUID
   * @param {Object} updates - Fields to update
   */
  update: async (uuid, updates) => {
    if (USE_LOCAL_IO) {
      return local_mock.user.update(uuid, updates)
    }
    /* c8 ignore next 6 */
    const set_clauses = Object.keys(updates)
      .map((k) => `u.${k} = $${k}`)
      .join(', ')
    await graph.query(
      `MATCH (u:User) WHERE u.uuid = $uuid SET ${set_clauses}`,
      {
        params: { uuid, ...updates },
      }
    )
  },

  /**
   * Delete user and all sessions
   * @param {string} uuid - User UUID
   */
  delete: async (uuid) => {
    if (USE_LOCAL_IO) {
      return local_mock.user.delete(uuid)
    }
    /* c8 ignore next 4 */
    await graph.query(
      'MATCH (u:User) WHERE u.uuid = $uuid OPTIONAL MATCH (u)-[r:HAS_SESSION]->(s:Session) DELETE r, s, u',
      { params: { uuid } }
    )
  },

  /**
   * Get all user sessions
   * @param {string} user_uuid - User UUID
   * @returns {Array} Array of session objects
   */
  get_sessions: async (user_uuid) => {
    if (USE_LOCAL_IO) {
      return local_mock.user.get_sessions(user_uuid)
    }
    /* c8 ignore next 5 */
    const result = await graph.query(
      'MATCH (u:User)-[:HAS_SESSION]->(s:Session) WHERE u.uuid = $uuid RETURN s',
      { params: { uuid: user_uuid } }
    )
    return extract_nodes(result, 's')
  },
}

/**
 * Session operations
 */
export const session_db = {
  /**
   * Create a new session linked to user
   * @param {string} user_uuid - User UUID
   * @param {Object} session - Session object with uuid, ip, browserName, etc.
   */
  create: async (user_uuid, session) => {
    if (USE_LOCAL_IO) {
      return local_mock.session.create(user_uuid, session)
    }
    /* c8 ignore next 4 */
    await graph.query(
      'MATCH (u:User) WHERE u.uuid = $user_uuid CREATE (u)-[:HAS_SESSION]->(s:Session $props) RETURN s',
      { params: { user_uuid, props: session } }
    )
  },

  /**
   * Find session by UUID
   * @param {string} uuid - Session UUID
   * @returns {Object|null} Session object or null
   */
  find_by_uuid: async (uuid) => {
    if (USE_LOCAL_IO) {
      return local_mock.session.find_by_uuid(uuid)
    }
    /* c8 ignore next 5 */
    const result = await graph.query(
      'MATCH (s:Session) WHERE s.uuid = $uuid RETURN s LIMIT 1',
      { params: { uuid } }
    )
    return extract_node(result, 's')
  },

  /**
   * Update session fields
   * @param {string} uuid - Session UUID
   * @param {Object} updates - Fields to update
   */
  update: async (uuid, updates) => {
    if (USE_LOCAL_IO) {
      return local_mock.session.update(uuid, updates)
    }
    /* c8 ignore next 6 */
    const set_clauses = Object.keys(updates)
      .map((k) => `s.${k} = $${k}`)
      .join(', ')
    await graph.query(
      `MATCH (s:Session) WHERE s.uuid = $uuid SET ${set_clauses}`,
      { params: { uuid, ...updates } }
    )
  },

  /**
   * Delete session
   * @param {string} user_uuid - User UUID
   * @param {string} session_uuid - Session UUID
   */
  delete: async (user_uuid, session_uuid) => {
    if (USE_LOCAL_IO) {
      return local_mock.session.delete(user_uuid, session_uuid)
    }
    /* c8 ignore next 4 */
    await graph.query(
      'MATCH (u:User)-[r:HAS_SESSION]->(s:Session) WHERE u.uuid = $user_uuid AND s.uuid = $session_uuid DELETE r, s',
      { params: { user_uuid, session_uuid } }
    )
  },

  /**
   * Delete all sessions for a user
   * @param {string} user_uuid - User UUID
   */
  delete_all_for_user: async (user_uuid) => {
    if (USE_LOCAL_IO) {
      return local_mock.session.delete_all_for_user(user_uuid)
    }
    /* c8 ignore next 4 */
    await graph.query(
      'MATCH (u:User)-[r:HAS_SESSION]->(s:Session) WHERE u.uuid = $uuid DELETE r, s',
      { params: { uuid: user_uuid } }
    )
  },
}

/**
 * Clear all data (for testing)
 */
export const clear_database = async () => {
  if (USE_LOCAL_IO) {
    local_mock.clear()
    return
  }
  /* c8 ignore next */
  await graph.query('MATCH (n) DETACH DELETE n')
}
