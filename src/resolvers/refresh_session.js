import { ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async (_, { koa_context, Graph, force_logout }) => {
  const token = Token(koa_context)
  const bearer = token.get(true)

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const { user, session } = await Graph.run`
  MATCH (user:User)
  WHERE user.uuid = ${ bearer.uuid }
  WITH user
  OPTIONAL MATCH (user)-->(s:Session)
  WHERE s.uuid = ${ bearer.session }
  RETURN user, s as session
  `

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
  if (!session) {
    force_logout()
    throw new GraphQLError(ERRORS.ILLEGAL_SESSION)
  }

  token.set({
    uuid    : bearer.uuid,
    session : bearer.session,
    remember: bearer.remember,
  })
  return true
}
