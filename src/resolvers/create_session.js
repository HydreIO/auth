import { ERRORS, ENVIRONMENT } from '../constant.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async (
  { mail, pwd, remember },
  { build_session, koa_context, Disk, sanitize },
) => {
  const [user] = await Disk.GET.User({
    search: `@mail:{${ sanitize(mail) }}`,
    limit : 1,
    fields: ['hash', 'sessions'],
  })

  if (!user) throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  if (!user.hash) throw new GraphQLError(ERRORS.NO_PASSWORD)

  const password_valid = bcrypt.compare(pwd, user.hash)

  if (!password_valid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const session = build_session()

  if (!session.browserName && !session.deviceVendor)
    throw new GraphQLError(ERRORS.ILLEGAL_SESSION)

  const sessions = JSON.parse(user.sessions)
  const deprecated_sessions = []
  const session_uuid = await Disk.CREATE.Session({ document: session })

  Token(koa_context).set({
    uuid   : user.uuid,
    session: session_uuid,
    remember,
  })

  sessions.push(session_uuid)

  while (sessions.length > ENVIRONMENT.MAX_SESSION_PER_USER)
    deprecated_sessions.push(sessions.shift())

  await Disk.SET.user({
    keys    : [user.uuid],
    limit   : 1,
    search  : '*',
    document: { sessions: JSON.stringify(sessions) },
  })

  if (deprecated_sessions.length) {
    await Disk.DELETE.Session({
      keys  : deprecated_sessions,
      search: '*',
    })
  }
}
