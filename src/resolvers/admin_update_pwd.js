import { ERRORS } from '../constant.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async ({ id, pwd }, { koa_context, Graph, force_logout }) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const { user } = await Graph.run`
  MATCH (user:User { uuid: ${ bearer.uuid }}) RETURN DISTINCT user`

  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  if (!user.superadmin) throw new GraphQLError(ERRORS.UNAUTHORIZED)

  await Graph.run`
  MATCH (u:User)
  WHERE u.uuid = ${ id }
  SET u.hash = ${ await bcrypt.hash(pwd, 10) }`

  return true
}
