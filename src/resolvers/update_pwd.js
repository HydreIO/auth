import { ERRORS, ENVIRONMENT } from '../constant.js'
import { GraphQLError } from 'graphql'
import bcrypt from 'bcryptjs'
import { user_db } from '../database.js'
import crypto from 'crypto'

const DAY = 86400000

export default async ({ code, mail, pwd }, { redis, force_logout }) => {
  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  const user = await user_db.find_by_email(redis, mail)

  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  // codes expire after a day - use timing-safe comparison to prevent timing attacks
  // Always pad to 64 bytes to prevent timing attacks based on code length
  const code_match = user.reset_code
    ? crypto.timingSafeEqual(
        Buffer.from(code.padEnd(64, '0')),
        Buffer.from(user.reset_code.padEnd(64, '0'))
      )
    : false

  if (!code_match || user.last_reset_code_sent + DAY < Date.now())
    throw new GraphQLError(ERRORS.INVALID_CODE)

  await user_db.update(redis, user.uuid, {
    reset_code: undefined,
    hash: await bcrypt.hash(pwd, ENVIRONMENT.BCRYPT_ROUNDS),
  })
  return true
}
