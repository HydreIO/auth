import { ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async (_, { koa_context, Disk }) => {
  const token = Token(koa_context)
  const bearer = token.get(true)

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [user] = await Disk.GET.User({
    keys  : [bearer.uuid],
    search: '*',
    fields: ['sessions'],
    limit : 1,
  })

  if (!user) throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  // the session may have been revoked
  if (!new Set(JSON.parse(user.sessions) ?? []).has(bearer.session))
    throw new GraphQLError(ERRORS.ILLEGAL_SESSION)

  token.set(bearer)
  return true
}
