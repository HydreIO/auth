import { ERRORS, ENVIRONMENT } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import bcrypt from 'bcryptjs'
import Token from '../token.js'
import { user_db } from '../database.js'

export default async (
  { current_pwd, new_pwd },
  { redis, force_logout, koa_context }
) => {
  if (!new_pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  const bearer = await Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const user = await user_db.find_by_uuid(redis, bearer.uuid)

  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  const password_valid = await bcrypt.compare(current_pwd, user.hash)

  if (!password_valid) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  await user_db.update(redis, bearer.uuid, {
    hash: await bcrypt.hash(new_pwd, ENVIRONMENT.BCRYPT_ROUNDS),
  })
  return true
}
