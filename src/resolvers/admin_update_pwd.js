import { ERRORS, ENVIRONMENT } from '../constant.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql'
import Token from '../token.js'
import { user_db } from '../database.js'

export default async ({ id, pwd }, { koa_context, redis, force_logout }) => {
  const bearer = await Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const user = await user_db.find_by_uuid(redis, bearer.uuid)

  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  if (!user.superadmin) throw new GraphQLError(ERRORS.UNAUTHORIZED)

  // SECURITY FIX: Validate password against PWD_REGEX before hashing
  if (!ENVIRONMENT.PWD_REGEX.test(pwd)) {
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)
  }

  await user_db.update(redis, id, {
    hash: await bcrypt.hash(pwd, ENVIRONMENT.BCRYPT_ROUNDS),
  })

  return true
}
