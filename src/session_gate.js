import { ENVIRONMENT, ERRORS } from './constant.js'
import { GraphQLError } from 'graphql'
import { v4 as uuid4 } from 'uuid'
import MAIL from './mail.js'
import { user_db, session_db } from './database.js'

/**
 * Shared session creation gate that handles:
 * - Session fingerprint validation
 * - Pruning old sessions per MAX_SESSION_PER_USER
 * - Device metadata storage
 * - Email notifications
 *
 * Used by both GraphQL create_session resolver and OAuth callback
 */
export async function create_or_update_session({
  redis,
  user_uuid,
  user_email,
  session_data,
  lang = 'en',
  publish = null,
  should_mark_logged_once = false,
}) {
  // Validate session fingerprint (must have BOTH device info - stronger security)
  if (!session_data.browserName || !session_data.deviceVendor) {
    throw new GraphQLError(ERRORS.ILLEGAL_SESSION)
  }

  // Get existing sessions
  const existing_sessions = await user_db.get_sessions(redis, user_uuid)

  // Check if session with same fingerprint already exists
  const matching_session = existing_sessions.find(
    (s) => s.hash === session_data.hash
  )

  const session_uuid = matching_session?.uuid || `Session:${uuid4()}`
  const current_timestamp = Date.now()

  const session = {
    ...session_data,
    uuid: session_uuid,
    last_used: current_timestamp,
  }

  // Mark user as logged in once if needed
  if (should_mark_logged_once && publish) {
    await user_db.update(redis, user_uuid, { logged_once: true })
    await publish(user_uuid)
  }

  if (matching_session) {
    // Session exists - just update last usage timestamp
    await session_db.update(redis, matching_session.uuid, {
      last_used: current_timestamp,
    })

    return {
      session_uuid: matching_session.uuid,
      is_new_session: false,
    }
  }

  // New session - prune old sessions first to avoid spam emails
  existing_sessions.sort((s1, s2) => s1.last_used - s2.last_used)

  while (existing_sessions.length >= ENVIRONMENT.MAX_SESSION_PER_USER) {
    const deprecated_session = existing_sessions.shift()
    await session_db.delete(redis, user_uuid, deprecated_session.uuid)
  }

  // Send email notification for new session (sanitize user-agent parsed fields)
  const { ip, browserName, osName, deviceModel, deviceType, deviceVendor } =
    session

  // Sanitize fields to prevent email injection
  const sanitize = (str) =>
    str
      ? String(str)
          .replace(/[<>\n\r]/g, '')
          .slice(0, 100)
      : 'Unknown'

  await MAIL.send([
    MAIL.NEW_SESSION,
    user_email,
    lang,
    undefined,
    JSON.stringify({
      ip: sanitize(ip),
      browserName: sanitize(browserName),
      osName: sanitize(osName),
      deviceModel: sanitize(deviceModel),
      deviceType: sanitize(deviceType),
      deviceVendor: sanitize(deviceVendor),
    }),
  ])

  // Create new session
  await session_db.create(redis, user_uuid, session)

  return {
    session_uuid,
    is_new_session: true,
  }
}
