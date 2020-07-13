import { ERRORS, ENVIRONMENT } from '../constant.js'
import MAIL from '../mail.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'
import { v4 as uuid4 } from 'uuid'

export default async ({ mail, payload }, { koa_context, Graph }) => {
  if (!ENVIRONMENT.ALLOW_REGISTRATION)
    throw new GraphQLError(ERRORS.REGISTRATION_DISABLED)

  if (!mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const { invited_id } = await Graph.run`
    MATCH (user:User)
    WHERE user.mail = ${ mail }
    RETURN DISTINCT user.uuid AS invited_id
    `

  if (invited_id) throw new GraphQLError(ERRORS.MAIL_USED)

  const user = {
    uuid                       : `User:${ uuid4() }`,
    mail,
    // verified because the invitation already prove the mail identity
    verified                   : true,
    last_reset_code_sent       : 0,
    last_verification_code_sent: 0,
  }

  await Graph.run`CREATE (u:User ${ user })`
  await MAIL.send([MAIL.ACCOUNT_INVITE, bearer.uuid, user.uuid, payload, mail])
  return true
}
