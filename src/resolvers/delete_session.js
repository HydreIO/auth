import Token from '../token.js'
import { user_db, session_db } from '../database.js'

export default async ({ id }, { koa_context, redis, force_logout }) => {
  const token = Token(koa_context)
  const bearer = await token.get()

  if (!bearer.uuid) {
    force_logout()
    return true
  }

  const user = await user_db.find_by_uuid(redis, bearer.uuid)

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

  // Delete the session
  await session_db.delete(redis, bearer.uuid, id ?? bearer.session)

  return true
}
