import MAIL from '../mail.js'
import { ENVIRONMENT, ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import jwt from 'jsonwebtoken'

export default async ({ mail, lang }, { Graph }) => {
  const [{ user } = {}] = await Graph.run`
  MATCH (user:User)
  WHERE user.mail = ${ mail }
  RETURN DISTINCT user`

  if (user) {
    const { last_reset_code_sent } = user
    const { RESET_PASS_DELAY } = ENVIRONMENT

    if (last_reset_code_sent + RESET_PASS_DELAY > Date.now())
      throw new GraphQLError(ERRORS.SPAM)

    const reset_code = [...new Array(64)]
        .map(() => (~~(Math.random() * 36)).toString(36))
        .join('')
    const mail_action_object = {
      action: MAIL.PASSWORD_RESET,
      code  : reset_code,
      mail,
    }
    const jwt_mail_action = jwt.sign(
        mail_action_object,
        ENVIRONMENT.MAIL_PRIVATE_KEY,
        {
          algorithm: 'ES256',
          expiresIn: '1d',
        },
    )

    await Graph.run`
    MATCH (u:User)
    WHERE u.uuid = ${ user.uuid }
    SET u.reset_code = ${ reset_code }, u.last_reset_code_sent = ${ Date.now() }
    `

    await MAIL.send([
      MAIL.PASSWORD_RESET,
      user.uuid,
      mail,
      jwt_mail_action,
      lang,
    ])
  }

  return true
}
