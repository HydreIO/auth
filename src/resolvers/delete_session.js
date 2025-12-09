import Token from '../token.js'
import { user_db, session_db, master_client } from '../database.js'
import { ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql'

export default async ({ id }, { koa_context, force_logout }) => {
  const token = Token(koa_context)
  const bearer = await token.get()

  if (!bearer.uuid) {
    force_logout()
    return true
  }

  const user = await user_db.find_by_uuid(bearer.uuid)

  // particular case where an user would have been deleted
  // while still being logged
  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    return true
  }

  // logout if the id is not provied
  if (!id) force_logout()

  // IDOR protection: verify session belongs to user
  if (id) {
    const session = await session_db.find_by_uuid(id)
    const user_sessions = await master_client.call(
      'SMEMBERS',
      `user:${bearer.uuid}:sessions`
    )
    if (!session || !user_sessions.includes(id)) {
      throw new GraphQLError(ERRORS.ILLEGAL_SESSION)
    }
  }

  // Delete the session
  await session_db.delete(bearer.uuid, id ?? bearer.session)

  return true
}
