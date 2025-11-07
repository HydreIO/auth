import { ERRORS, ENVIRONMENT } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'
import { v4 as uuid4 } from 'uuid'
import { user_db } from '../database.js'

export default async ({ mail }, { koa_context, redis }) => {
  if (!ENVIRONMENT.ALLOW_REGISTRATION)
    throw new GraphQLError(ERRORS.REGISTRATION_DISABLED)

  if (!mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  const bearer = await Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  // Check if user already exists
  const existing_user = await user_db.find_by_email(redis, mail)

  if (existing_user) throw new GraphQLError(ERRORS.MAIL_USED)

  const reset_code = [...new Array(64)]
    .map(() => (~~(Math.random() * 36)).toString(36))
    .join('')
  const user = {
    uuid: `User:${uuid4()}`,
    mail,
    // verified because the invitation already prove the mail identity
    reset_code,
    verified: true,
    last_reset_code_sent: Date.now(),
    last_verification_code_sent: 0,
    member_since: Date.now(),
  }

  await user_db.create(redis, user)
  return user.uuid
}
