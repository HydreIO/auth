import { ERRORS, validate_email_whitelist } from '../constant.js'
import { GraphQLError } from 'graphql'
import Token from '../token.js'
import { user_db, session_db } from '../database.js'

export default async (_, { koa_context, force_logout }) => {
  const token = Token(koa_context)
  const bearer = await token.get(true)

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  // Find user and session
  const user = await user_db.find_by_uuid(bearer.uuid)

  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  // Validate email against whitelist
  try {
    validate_email_whitelist(user.mail)
  } catch (error) {
    force_logout()
    throw new GraphQLError(error.message)
  }

  // Check if session still exists
  const session = await session_db.find_by_uuid(bearer.session)

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
