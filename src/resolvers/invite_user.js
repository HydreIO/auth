import { ERRORS, ENVIRONMENT, validate_email_whitelist } from '../constant.js'
import { GraphQLError } from 'graphql'
import Token from '../token.js'
import { v4 as uuid4 } from 'uuid'
import { user_db } from '../database.js'
import crypto from 'crypto'

export default async ({ mail }, { koa_context }) => {
  if (!ENVIRONMENT.ALLOW_REGISTRATION)
    throw new GraphQLError(ERRORS.REGISTRATION_DISABLED)

  if (!mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  // Validate email against whitelist
  try {
    validate_email_whitelist(mail)
  } catch (error) {
    throw new GraphQLError(error.message)
  }

  const bearer = await Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  // Authorization: Only admins can invite users
  const inviter = await user_db.find_by_uuid(bearer.uuid)
  if (!inviter || !inviter.superadmin) {
    throw new GraphQLError(ERRORS.UNAUTHORIZED)
  }

  // Check if user already exists
  const existing_user = await user_db.find_by_email(mail)

  if (existing_user) throw new GraphQLError(ERRORS.MAIL_USED)

  const reset_code = crypto.randomBytes(32).toString('hex')
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

  await user_db.create(user)
  return user.uuid
}
