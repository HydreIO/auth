/* eslint-disable complexity */
// this resolver would be more complex if
// we extract the code to validate this rule
import { ERRORS, ENVIRONMENT } from '../constant.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async (
  { mail, pwd, remember },
  { build_session, koa_context, Disk, sanitize, force_logout },
) => {
  if (!mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  const [user] = await Disk.GET.User({
    search: `@mail:{${ sanitize(mail) }}`,
    limit : 1,
    fields: ['hash', 'sessions'],
  })

  // this check is ahead of the USER_NOT_FOUND
  // because an invited/created user need to know if he already has a pwd or not
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

  const session = build_session()

  if (!session.browserName && !session.deviceVendor)
    throw new GraphQLError(ERRORS.ILLEGAL_SESSION)

  const sessions = JSON.parse(user.sessions)
  const [session_exist] = await Disk.KEYS.Session({
    keys  : sessions,
    search: `@hash:{${ session.hash }}`,
    limit : 1,
  })
  const deprecated_sessions = []
  const session_uuid
    = session_exist ?? await Disk.CREATE.Session({ document: session })

  Token(koa_context).set({
    uuid   : user.uuid,
    session: session_uuid,
    remember,
  })

  if (!session_exist) {
    sessions.push(session_uuid)
    while (sessions.length > ENVIRONMENT.MAX_SESSION_PER_USER)
      deprecated_sessions.push(sessions.shift())
  }

  await Disk.SET.User({
    keys    : [user.uuid],
    limit   : 1,
    document: { sessions: JSON.stringify(sessions) },
  })

  if (deprecated_sessions.length) {
    /* c8 ignore next 5 */
    // need creating many user agent
    await Disk.DELETE.Session({
      keys: deprecated_sessions,
    })
  }

  return !session_exist
}
