import { ERRORS, ENVIRONMENT } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import bcrypt from 'bcryptjs'
import { user_db } from '../database.js'

const DAY = 86400000

export default async ({ code, mail, pwd }, { redis, force_logout }) => {
  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  const user = await user_db.find_by_email(redis, mail)

  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  // codes expire after a day
  if (user.reset_code !== code || user.last_reset_code_sent + DAY < Date.now())
    throw new GraphQLError(ERRORS.INVALID_CODE)

  await user_db.update(redis, user.uuid, {
    reset_code: undefined,
    hash: await bcrypt.hash(pwd, ENVIRONMENT.BCRYPT_ROUNDS),
  })
  return true
}
