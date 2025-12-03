import MAIL from '../mail.js'
import { ENVIRONMENT, ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql'
import Token from '../token.js'
import { SignJWT, importPKCS8 } from 'jose'
import { user_db } from '../database.js'

// Import private key using jose
const private_key = await importPKCS8(ENVIRONMENT.PRIVATE_KEY, 'ES512')

export default async ({ lang }, { redis, koa_context, force_logout }) => {
  const bearer = await Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const user = await user_db.find_by_uuid(redis, bearer.uuid)

  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  const { last_verification_code_sent, mail } = user
  const { CONFIRM_ACCOUNT_DELAY } = ENVIRONMENT

  // No-op if email is disabled (user is auto-verified)
  if (!ENVIRONMENT.ENABLE_EMAIL) {
    return true
  }

  if (last_verification_code_sent + CONFIRM_ACCOUNT_DELAY > Date.now())
    throw new GraphQLError(ERRORS.SPAM)

  const verification_code = await new SignJWT({ uuid: user.uuid })
    .setProtectedHeader({ alg: 'ES512' })
    .setIssuedAt()
    .setExpirationTime(ENVIRONMENT.CONFIRM_ACCOUNT_TOKEN_EXPIRATION)
    .sign(private_key)

  await MAIL.send([
    MAIL.ACCOUNT_CONFIRM,
    mail,
    lang,
    JSON.stringify({
      code: verification_code,
      mail,
    }),
  ])

  await user_db.update(redis, user.uuid, {
    last_verification_code_sent: Date.now(),
  })

  return true
}
