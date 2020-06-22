import { ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async (_, { koa_context, Disk, force_logout }) => {
  const token = Token(koa_context)
  const bearer = token.get(true)

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [user] = await Disk.GET.User({
    keys  : [bearer.uuid],
    fields: ['sessions'],
    limit : 1,
  })

  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  // the session may have been revoked and in that case we forbid the refresh
  // this is the only place we check for session validation
  // the point in having an access token is to avoid checking this
  // on every request, that mean until expiration the token
  // is always valid
  if (!new Set(JSON.parse(user.sessions) ?? []).has(bearer.session)) {
    force_logout()
    throw new GraphQLError(ERRORS.ILLEGAL_SESSION)
  }

  // getting rid of the old expiration limit
  delete bearer.exp
  token.set(bearer)
  return true
}
