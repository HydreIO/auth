import { ERRORS, ENVIRONMENT } from '../constant.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql'
import Token from '../token.js'
import { v4 as uuid4 } from 'uuid'
import MAIL from '../mail.js'
import { user_db, session_db } from '../database.js'

export default async (
  { mail, pwd, remember, lang },
  { build_session, publish, koa_context, redis, force_logout }
) => {
  if (!mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  // Find user and get existing sessions
  const user = await user_db.find_by_email(redis, mail)

  // Check if user has password (for invited users)
  if (user && !user.hash) throw new GraphQLError(ERRORS.NO_PASSWORD)

  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  const password_valid = await bcrypt.compare(pwd, user.hash)

  if (!password_valid) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  const built_session = build_session()

  if (!built_session.browserName && !built_session.deviceVendor)
    throw new GraphQLError(ERRORS.ILLEGAL_SESSION)

  // Get existing sessions
  const existing_sessions = await user_db.get_sessions(redis, user.uuid)

  // Check if session already exists
  const matching_session = existing_sessions.find(
    (s) => s.hash === built_session.hash
  )

  const session = {
    ...built_session,
    uuid: `Session:${uuid4()}`,
    last_used: Date.now(),
  }

  // Mark user as logged in once
  if (!user.logged_once) {
    await user_db.update(redis, user.uuid, { logged_once: true })
    await publish(user.uuid)
  }

  if (matching_session) {
    // Session exists, update last usage
    await session_db.update(redis, matching_session.uuid, {
      last_used: Date.now(),
    })
  } else {
    // Clean up old sessions BEFORE creating new one to avoid spam emails
    existing_sessions.sort((s1, s2) => s1.last_used - s2.last_used)

    while (existing_sessions.length >= ENVIRONMENT.MAX_SESSION_PER_USER) {
      const deprecated_session = existing_sessions.shift()
      await session_db.delete(redis, user.uuid, deprecated_session.uuid)
    }

    // Create new session
    const { ip, browserName, osName, deviceModel, deviceType, deviceVendor } =
      session

    await MAIL.send([
      MAIL.NEW_SESSION,
      mail,
      lang,
      undefined,
      JSON.stringify({
        ip,
        browserName,
        osName,
        deviceModel,
        deviceType,
        deviceVendor,
      }),
    ])

    await session_db.create(redis, user.uuid, session)
  }

  // Set JWT token
  await Token(koa_context).set({
    uuid: user.uuid,
    session: matching_session?.uuid || session.uuid,
    remember,
  })

  return !matching_session
}
