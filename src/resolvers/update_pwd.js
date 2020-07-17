import { ERRORS, ENVIRONMENT } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import bcrypt from 'bcryptjs'

const DAY = 86400000

export default async ({ code, mail, pwd }, { Graph, force_logout }) => {
  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

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
