import { ERRORS, ENVIRONMENT } from '../constant.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql'
import MAIL from '../mail.js'
import { v4 as uuid4 } from 'uuid'
import { SignJWT, importPKCS8 } from 'jose'
import { user_db } from '../database.js'

// Import private key using jose
const private_key = await importPKCS8(ENVIRONMENT.PRIVATE_KEY, 'ES512')

export default async ({ mail, pwd, lang }, { redis }) => {
  if (!ENVIRONMENT.ALLOW_REGISTRATION)
    throw new GraphQLError(ERRORS.REGISTRATION_DISABLED)

  if (!mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  // Check if user exists
  const existing_user = await user_db.find_by_email(redis, mail)
  if (existing_user) throw new GraphQLError(ERRORS.MAIL_USED)

  // Create verification code
  const user_uuid = `User:${uuid4()}`
  const verification_code = await new SignJWT({ uuid: user_uuid })
    .setProtectedHeader({ alg: 'ES512' })
    .setIssuedAt()
    .setIssuer(ENVIRONMENT.JWT_ISSUER)
    .setAudience(ENVIRONMENT.JWT_AUDIENCE)
    .setExpirationTime(ENVIRONMENT.CONFIRM_ACCOUNT_TOKEN_EXPIRATION)
    .sign(private_key)

  const user = {
    uuid: user_uuid,
    mail,
    verification_code,
    hash: pwd ? await bcrypt.hash(pwd, ENVIRONMENT.BCRYPT_ROUNDS) : undefined,
    verified: false,
    last_reset_code_sent: 0,
    last_verification_code_sent: Date.now(),
    member_since: Date.now(),
  }

  await user_db.create(redis, user)

  await MAIL.send([
    MAIL.ACCOUNT_CREATE,
    mail,
    lang,
    JSON.stringify({
      code: verification_code,
      mail,
    }),
  ])

  return true
}
