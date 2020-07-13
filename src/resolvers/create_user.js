import { ERRORS, ENVIRONMENT } from '../constant.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql/index.mjs'
import MAIL from '../mail.js'
import { v4 as uuid4 } from 'uuid'

export default async ({ mail, pwd }, { Graph }) => {
  if (!ENVIRONMENT.ALLOW_REGISTRATION)
    throw new GraphQLError(ERRORS.REGISTRATION_DISABLED)

  if (!mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  const { user_id } = await Graph.run`
    MATCH (user:User)
    WHERE user.mail = ${ mail }
    RETURN DISTINCT user.uuid as user_id
    `

  if (user_id) throw new GraphQLError(ERRORS.MAIL_USED)

  const verification_code = [...new Array(64)]
      .map(() => (~~(Math.random() * 36)).toString(36))
      .join('')
  const user = {
    uuid                       : `User:${ uuid4() }`,
    mail,
    verification_code,
    hash                       : pwd ? await bcrypt.hash(pwd, 10) : undefined,
    verified                   : false,
    last_reset_code_sent       : 0,
    last_verification_code_sent: Date.now(),
  }

  await Graph.run`CREATE (u:User ${ user })`
  await MAIL.send([MAIL.ACCOUNT_CREATE, user.uuid, mail, verification_code])
  return true
}
