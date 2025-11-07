import { ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'
import { user_db, session_db } from '../database.js'

export default async (_, { koa_context, redis, force_logout }) => {
  const token = Token(koa_context)
  const bearer = await token.get(true)

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  // Find user and session
  const user = await user_db.find_by_uuid(redis, bearer.uuid)

  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  // Check if session still exists
  const session = await session_db.find_by_uuid(redis, bearer.session)

  // the session may have been revoked and in that case we forbid the refresh
  // this is the only place we check for session validation
  // the point in having an access token is to avoid checking this
  // on every request, that mean until expiration the token
  // is always valid
  if (!session) {
    force_logout()
    throw new GraphQLError(ERRORS.ILLEGAL_SESSION)
  }

  await token.set({
    uuid: bearer.uuid,
    session: bearer.session,
    remember: bearer.remember,
  })
  return true
}
