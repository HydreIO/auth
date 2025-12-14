/**
 * Database layer for authentication
 * FalkorDB graph database with Cypher queries
 */
import { FalkorDB } from 'falkordb'

import { ENVIRONMENT } from './constant.js'

const { REDIS_HOST } = ENVIRONMENT
const REDIS_PORT = process.env.REDIS_PORT ?? 6379
const GRAPH_NAME = process.env.GRAPH_NAME ?? 'global'

// Connection state for health checks
export const connection_state = {
  online: false,
}

// Connect to FalkorDB
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

connection_state.online = true

/**
 * Filter out undefined values from params object
 * FalkorDB throws "Unexpected param type undefined" for undefined values
 * @param {Object} obj - Object with properties
 * @returns {Object} Object with only defined values
 */
const clean_params = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))

/**
 * Build property assignment string for CREATE queries
 * Filters out undefined/null values to avoid FalkorDB param errors
 * @param {Object} obj - Object with properties
 * @returns {string} Property string like "{uuid: $uuid, mail: $mail}"
 */
const build_props_string = (obj) => {
  const valid_keys = Object.keys(obj).filter((k) => obj[k] !== undefined)
  const assignments = valid_keys.map((k) => `${k}: $${k}`)
  return `{${assignments.join(', ')}}`
}

/**
 * Extract node properties from query result
 * FalkorDB returns nodes as {id, labels, properties} - we want just properties
 */
const extract_node = (result, alias) => {
  const { data } = result ?? {}
  if (!data || data.length === 0) return null
  const [row] = data
  const node = row?.[alias]
  return node?.properties ?? null
}

/**
 * Extract multiple nodes from query result
 */
const extract_nodes = (result, alias) => {
  const { data } = result ?? {}
  if (!data || data.length === 0) return []
  return data.map((row) => row?.[alias]?.properties).filter(Boolean)
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
    const clean_user = clean_params(user)
    const props_string = build_props_string(clean_user)
    await graph.query(`CREATE (u:User ${props_string}) RETURN u`, {
      params: clean_user,
    })
  },

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Object|null} User object or null
   */
  find_by_email: async (email) => {
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
    const clean_updates = clean_params(updates)
    const set_clauses = Object.keys(clean_updates)
      .map((k) => `u.${k} = $${k}`)
      .join(', ')
    if (!set_clauses) return // Nothing to update
    await graph.query(
      `MATCH (u:User) WHERE u.uuid = $uuid SET ${set_clauses}`,
      {
        params: { uuid, ...clean_updates },
      }
    )
  },

  /**
   * Delete user and all sessions
   * @param {string} uuid - User UUID
   */
  delete: async (uuid) => {
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
    const result = await graph.query(
      'MATCH (u:User)-[:HAS_SESSION]->(s:Session) WHERE u.uuid = $uuid RETURN s',
      { params: { uuid: user_uuid } }
    )
    return extract_nodes(result, 's')
  },

  /**
   * Count total users (for first-user-is-admin check)
   * @returns {number} User count
   */
  count: async () => {
    const result = await graph.query('MATCH (u:User) RETURN count(u) as count')
    const { data } = result ?? {}
    if (!data || data.length === 0) return 0
    return data[0]?.count ?? 0
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
    const clean_session = clean_params(session)
    const props_string = build_props_string(clean_session)
    await graph.query(
      `MATCH (u:User) WHERE u.uuid = $user_uuid CREATE (u)-[:HAS_SESSION]->(s:Session ${props_string}) RETURN s`,
      { params: { user_uuid, ...clean_session } }
    )
  },

  /**
   * Find session by UUID
   * @param {string} uuid - Session UUID
   * @returns {Object|null} Session object or null
   */
  find_by_uuid: async (uuid) => {
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
    const clean_updates = clean_params(updates)
    const set_clauses = Object.keys(clean_updates)
      .map((k) => `s.${k} = $${k}`)
      .join(', ')
    if (!set_clauses) return // Nothing to update
    await graph.query(
      `MATCH (s:Session) WHERE s.uuid = $uuid SET ${set_clauses}`,
      { params: { uuid, ...clean_updates } }
    )
  },

  /**
   * Delete session
   * @param {string} user_uuid - User UUID
   * @param {string} session_uuid - Session UUID
   */
  delete: async (user_uuid, session_uuid) => {
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
  await graph.query('MATCH (n) DETACH DELETE n')
}

/**
 * Close database connection (for graceful shutdown)
 */
export const close_database = async () => {
  await db.close()
}
