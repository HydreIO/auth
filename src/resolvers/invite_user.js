import { ERRORS, ENVIRONMENT } from '../constant.js'
import MAIL from '../mail.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'
import { v4 as uuid4 } from 'uuid'
import jwt from 'jsonwebtoken'

export default async ({ mail, lang }, { koa_context, Graph }) => {
  if (!ENVIRONMENT.ALLOW_REGISTRATION)
    throw new GraphQLError(ERRORS.REGISTRATION_DISABLED)

  if (!mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [{ invited_id } = {}] = await Graph.run`
    MATCH (user:User)
    WHERE user.mail = ${ mail }
    RETURN DISTINCT user.uuid AS invited_id
    `

  if (invited_id) throw new GraphQLError(ERRORS.MAIL_USED)

  const reset_code = [...new Array(64)]
      .map(() => (~~(Math.random() * 36)).toString(36))
      .join('')
  const user = {
    uuid                       : `User:${ uuid4() }`,
    mail,
    // verified because the invitation already prove the mail identity
    reset_code,
    verified                   : true,
    last_reset_code_sent       : Date.now(),
    last_verification_code_sent: 0,
    member_since               : Date.now(),
  }
  const mail_action_object = {
    'action': MAIL.ACCOUNT_INVITE,
    'code'  : reset_code,
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

  await Graph.run`CREATE (u:User ${ user })`
  await MAIL.send([
    MAIL.ACCOUNT_INVITE,
    bearer.uuid,
    user.uuid,
    lang,
    mail,
    jwt_mail_action,
  ])
  return user.uuid
}
