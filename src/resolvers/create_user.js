import { ERRORS, ENVIRONMENT, validate_email_whitelist } from '../constant.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql'
import MAIL from '../mail.js'
import { v4 as uuid4 } from 'uuid'
import { SignJWT, importPKCS8 } from 'jose'
import { user_db } from '../database.js'

// Import private key using jose
const private_key = await importPKCS8(ENVIRONMENT.PRIVATE_KEY, 'ES512')

export default async ({ mail, pwd, lang }) => {
  if (!ENVIRONMENT.ALLOW_REGISTRATION)
    throw new GraphQLError(ERRORS.REGISTRATION_DISABLED)

  if (!mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  // Validate email against whitelist
  try {
    validate_email_whitelist(mail)
  } catch (error) {
    throw new GraphQLError(error.message)
  }

  // Check if user exists
  const existing_user = await user_db.find_by_email(mail)
  if (existing_user) throw new GraphQLError(ERRORS.MAIL_USED)

  // Check if this is the first user (make them superadmin)
  const user_count = await user_db.count()
  const is_first_user = user_count === 0

  // Create verification code
  const user_uuid = `User:${uuid4()}`
  const verification_code = await new SignJWT({ uuid: user_uuid })
    .setProtectedHeader({ alg: 'ES512' })
    .setIssuedAt()
    .setExpirationTime(ENVIRONMENT.CONFIRM_ACCOUNT_TOKEN_EXPIRATION)
    .sign(private_key)

  const user = {
    uuid: user_uuid,
    mail,
    verification_code,
    hash: pwd ? await bcrypt.hash(pwd, ENVIRONMENT.BCRYPT_ROUNDS) : undefined,
    verified: !ENVIRONMENT.ENABLE_EMAIL, // Auto-verify when email is disabled
    superadmin: is_first_user, // First user is superadmin
    last_reset_code_sent: 0,
    last_verification_code_sent: Date.now(),
    member_since: Date.now(),
  }

  await user_db.create(user)

  // Only send verification email if email is enabled
  if (ENVIRONMENT.ENABLE_EMAIL) {
    await MAIL.send([
      MAIL.ACCOUNT_CREATE,
      mail,
      lang,
      JSON.stringify({
        code: verification_code,
        mail,
      }),
    ])
  }

  return true
}
