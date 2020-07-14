import { ERRORS, ENVIRONMENT } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import bcrypt from 'bcryptjs'
import Token from '../token.js'

const DAY = 86400000

export default async (
  { code, mail, pwd },
  { Graph, force_logout, koa_context },
) => {
  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  if (!code) {
    // if no code is provided we assume the user is logged
    // and just wanna change his pwd.
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

    await Graph.run`
    MATCH (user:User { uuid: ${ bearer.uuid }})
    SET user.hash = ${ await bcrypt.hash(pwd, 10) }
    `
    return true
  }

  const [{ user } = {}] = await Graph.run`
  MATCH (user:User)
  WHERE user.mail = ${ mail }
  RETURN DISTINCT user`

  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  // codes expire after a day
  if (user.reset_code !== code || user.last_reset_code_sent + DAY < Date.now())
    throw new GraphQLError(ERRORS.INVALID_CODE)

  await Graph.run`
  MATCH (u:User)
  WHERE u.uuid = ${ user.uuid }
  SET u.reset_code = ${ undefined }, u.hash = ${ await bcrypt.hash(pwd, 10) }
  `
  return true
}
