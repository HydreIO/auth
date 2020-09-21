import { ERRORS, ENVIRONMENT } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'
import { v4 as uuid4 } from 'uuid'

export default async ({ mail }, { koa_context, Graph }) => {
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

  await Graph.run`CREATE (u:User ${ user })`
  return user.uuid
}
