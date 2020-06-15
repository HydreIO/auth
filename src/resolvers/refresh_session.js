import { ERRORS } from '../constant.js'
import DISK from '../disk.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async (_, { koa_context }) => {
  const token = Token(koa_context)
  const bearer = token.get(true)

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [user] = await DISK.User({
    type  : DISK.GET,
    filter: { uuids: [bearer.uuid] },
    fields: ['sessions'],
  })

  if (!user) throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  // the session may have been revoked
  if (!new Set(user.sessions).has(bearer.session))
    throw new GraphQLError(ERRORS.ILLEGAL_SESSION)

  token.set(bearer)
  return true
}
