import { ERRORS, ENVIRONMENT } from '../constant.js'
import DISK from '../disk.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async (
  { mail, pwd, remember },
  { build_session, koa_context },
) => {
  const [user] = await DISK.User({
    type  : DISK.GET,
    match : { mail },
    fields: ['hash', 'sessions'],
  })

  if (!user) throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  if (!user.hash) throw new GraphQLError(ERRORS.NO_PASSWORD)

  const password_valid = bcrypt.compare(pwd, user.hash)

  if (!password_valid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const session = build_session()

  if (!session.browserName && !session.deviceVendor)
    throw new GraphQLError(ERRORS.ILLEGAL_SESSION)

  const { sessions } = user
  const deprecated_sessions = []
  const session_uuid = await DISK.Session({
    type  : DISK.CREATE,
    fields: session,
  })

  Token(koa_context).set({
    uuid   : user.uuid,
    session: session_uuid,
    remember,
  })

  sessions.push(session_uuid)

  while (sessions.length > ENVIRONMENT.MAX_SESSION_PER_USER)
    deprecated_sessions.push(sessions.shift())

  await DISK.user({
    type  : DISK.SET,
    filter: { uuids: [user.uuid] },
    fields: { sessions },
  })

  // noop if uuids empty
  await DISK.Session({
    type  : DISK.DELETE,
    filter: { uuids: deprecated_sessions },
  })
}
