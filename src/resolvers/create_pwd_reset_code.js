import MAIL from '../mail.js'
import { ENVIRONMENT, ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql'
import { user_db } from '../database.js'

export default async ({ mail, lang }, { redis }) => {
  const user = await user_db.find_by_email(redis, mail)

  if (user) {
    const { last_reset_code_sent } = user
    const { RESET_PASS_DELAY } = ENVIRONMENT

    if (last_reset_code_sent + RESET_PASS_DELAY > Date.now())
      throw new GraphQLError(ERRORS.SPAM)

    const reset_code = [...new Array(64)]
      .map(() => (~~(Math.random() * 36)).toString(36))
      .join('')

    await user_db.update(redis, user.uuid, {
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
