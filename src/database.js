/**
 * Redis JSON data access layer for authentication
 * Replaces RedisGraph with simple Redis JSON + Sets
 */

/**
 * User operations
 */
export const user_db = {
  /**
   * Create a new user
   * @param {Object} client - Redis client
   * @param {Object} user - User object with uuid, mail, hash, etc.
   */
  create: async (client, user) => {
    // Store user object
    await client.call(
      'JSON.SET',
      `user:${user.uuid}`,
      '.',
      JSON.stringify(user)
    )
    // Create email → uuid index
    await client.set(`user:email:${user.mail}`, user.uuid)
  },

  /**
   * Find user by email
   * @param {Object} client - Redis client
   * @param {string} email - User email
   * @returns {Object|null} User object or null
   */
  find_by_email: async (client, email) => {
    const user_uuid = await client.get(`user:email:${email}`)
    if (!user_uuid) return null

    const user_json = await client.call('JSON.GET', `user:${user_uuid}`)
    return user_json ? JSON.parse(user_json) : null
  },

  /**
   * Find user by UUID
   * @param {Object} client - Redis client
   * @param {string} uuid - User UUID
   * @returns {Object|null} User object or null
   */
  find_by_uuid: async (client, uuid) => {
    const user_json = await client.call('JSON.GET', `user:${uuid}`)
    return user_json ? JSON.parse(user_json) : null
  },

  /**
   * Update user fields
   * @param {Object} client - Redis client
   * @param {string} uuid - User UUID
   * @param {Object} updates - Fields to update
   */
  update: async (client, uuid, updates) => {
    for (const [key, value] of Object.entries(updates)) {
      await client.call(
        'JSON.SET',
        `user:${uuid}`,
        `.${key}`,
        JSON.stringify(value)
      )
    }
  },

  /**
   * Delete user
   * @param {Object} client - Redis client
   * @param {string} uuid - User UUID
   */
  delete: async (client, uuid) => {
    const user = await user_db.find_by_uuid(client, uuid)
    if (!user) return

    // Delete all sessions first (includes individual session:* keys)
    await session_db.delete_all_for_user(client, uuid)
    // Delete email index
    await client.del(`user:email:${user.mail}`)
    // Delete user object
    await client.call('JSON.DEL', `user:${uuid}`)
  },

  /**
   * Get all user sessions
   * @param {Object} client - Redis client
   * @param {string} user_uuid - User UUID
   * @returns {Array} Array of session objects
   */
  get_sessions: async (client, user_uuid) => {
    const session_uuids = await client.smembers(`user:${user_uuid}:sessions`)
    if (!session_uuids || session_uuids.length === 0) return []

    const sessions = []
    for (const session_uuid of session_uuids) {
      const session = await session_db.find_by_uuid(client, session_uuid)
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
   * @param {Object} client - Redis client
   * @param {string} user_uuid - User UUID
   * @param {Object} session - Session object with uuid, ip, browserName, etc.
   */
  create: async (client, user_uuid, session) => {
    // Store session object
    await client.call(
      'JSON.SET',
      `session:${session.uuid}`,
      '.',
      JSON.stringify(session)
    )
    // Add to user's sessions set
    await client.sadd(`user:${user_uuid}:sessions`, session.uuid)
  },

  /**
   * Find session by UUID
   * @param {Object} client - Redis client
   * @param {string} uuid - Session UUID
   * @returns {Object|null} Session object or null
   */
  find_by_uuid: async (client, uuid) => {
    const session_json = await client.call('JSON.GET', `session:${uuid}`)
    return session_json ? JSON.parse(session_json) : null
  },

  /**
   * Update session fields
   * @param {Object} client - Redis client
   * @param {string} uuid - Session UUID
   * @param {Object} updates - Fields to update
   */
  update: async (client, uuid, updates) => {
    for (const [key, value] of Object.entries(updates)) {
      await client.call(
        'JSON.SET',
        `session:${uuid}`,
        `.${key}`,
        JSON.stringify(value)
      )
    }
  },

  /**
   * Delete session
   * @param {Object} client - Redis client
   * @param {string} user_uuid - User UUID
   * @param {string} session_uuid - Session UUID
   */
  delete: async (client, user_uuid, session_uuid) => {
    // Remove from user's sessions set
    await client.srem(`user:${user_uuid}:sessions`, session_uuid)
    // Delete session object
    await client.call('JSON.DEL', `session:${session_uuid}`)
  },

  /**
   * Delete all sessions for a user
   * @param {Object} client - Redis client
   * @param {string} user_uuid - User UUID
   */
  delete_all_for_user: async (client, user_uuid) => {
    const session_uuids = await client.smembers(`user:${user_uuid}:sessions`)
    if (!session_uuids || session_uuids.length === 0) return

    // Delete all session objects
    for (const session_uuid of session_uuids) {
      await client.call('JSON.DEL', `session:${session_uuid}`)
    }
    // Clear sessions set
    await client.del(`user:${user_uuid}:sessions`)
  },
}
