import { ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async ({ ids }, { koa_context, Graph, force_logout }) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [{ user } = {}] = await Graph.run`
  MATCH (user:User { uuid: ${ bearer.uuid }}) RETURN DISTINCT user`

  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  if (!user.superadmin) throw new GraphQLError(ERRORS.UNAUTHORIZED)

  await Graph.run`
  MATCH (u:User)
  WHERE u.uuid IN ${ ids }
  DELETE u
  `

  return true
}
