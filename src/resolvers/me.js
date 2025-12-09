import { ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql'
import Token from '../token.js'
import { user_db } from '../database.js'

export default async (_, { koa_context, force_logout }) => {
  const bearer = await Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const user = await user_db.find_by_uuid(bearer.uuid)

  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  return {
    ...user,
    sessions: async () => {
      const sessions = await user_db.get_sessions(user.uuid)
      return sessions
    },
  }
}
