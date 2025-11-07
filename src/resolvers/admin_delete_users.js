import { ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql'
import Token from '../token.js'
import { user_db } from '../database.js'

export default async ({ ids }, { koa_context, redis, force_logout }) => {
  const bearer = await Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const user = await user_db.find_by_uuid(redis, bearer.uuid)

  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  if (!user.superadmin) throw new GraphQLError(ERRORS.UNAUTHORIZED)

  // Delete all users in the list
  for (const id of ids) {
    await user_db.delete(redis, id)
  }

  return true
}
