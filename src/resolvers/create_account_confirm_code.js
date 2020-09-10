import MAIL from '../mail.js'
import { ENVIRONMENT, ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'
import { plus_equals } from '@hydre/rgraph/operators'
import jwt from 'jsonwebtoken'

export default async ({ lang }, { Graph, koa_context, force_logout }) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [{ user } = {}] = await Graph.run`
  MATCH (user:User { uuid: ${ bearer.uuid }}) RETURN DISTINCT user`

  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  const { last_verification_code_sent, mail, uuid } = user
  const { CONFIRM_ACCOUNT_DELAY } = ENVIRONMENT

  if (last_verification_code_sent + CONFIRM_ACCOUNT_DELAY > Date.now())
    throw new GraphQLError(ERRORS.SPAM)

  const verification_code = [...new Array(64)]
      .map(() => (~~(Math.random() * 36)).toString(36))
      .join('')
  const mail_action_object = {
    action: MAIL.ACCOUNT_CONFIRM,
    code  : verification_code,
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

  await MAIL.send([MAIL.ACCOUNT_CONFIRM, uuid, mail, jwt_mail_action, lang])
  await Graph.run`
  MATCH (u:User)
  WHERE u.uuid = ${ user.uuid }
  SET ${ plus_equals('u', {
    verification_code,
    last_verification_code_sent: Date.now(),
  }) }
  `

  return true
}
