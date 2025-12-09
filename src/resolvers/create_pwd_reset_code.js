import MAIL from '../mail.js'
import { ENVIRONMENT, ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql'
import { user_db } from '../database.js'
import crypto from 'crypto'

export default async ({ mail, lang }) => {
  const user = await user_db.find_by_email(mail)

  if (user) {
    // No-op if email is disabled (can't send reset code)
    if (!ENVIRONMENT.ENABLE_EMAIL) {
      return true
    }

    const { last_reset_code_sent } = user
    const { RESET_PASS_DELAY } = ENVIRONMENT

    if (last_reset_code_sent + RESET_PASS_DELAY > Date.now())
      throw new GraphQLError(ERRORS.SPAM)

    const reset_code = crypto.randomBytes(32).toString('hex')

    await user_db.update(user.uuid, {
      reset_code,
      last_reset_code_sent: Date.now(),
    })

    await MAIL.send([
      MAIL.PASSWORD_RESET,
      mail,
      lang,
      JSON.stringify({
        code: reset_code,
        mail,
      }),
    ])
  }

  return true
}
