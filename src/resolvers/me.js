import { ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async (_, { koa_context, Graph, force_logout }) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const { user } = await Graph.run`
  MATCH (user:User { uuid: ${ bearer.uuid }}) RETURN DISTINCT user`

  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  return {
    ...user,
    sessions: async () => {
      const { sessions = [] } = await Graph.run`
      MATCH (u:User)-[:HAS_SESSION]-(s:Session)
      WHERE u.uuid = ${ user.uuid }
      RETURN collect(s) as sessions
    `

      return sessions
    },
  }
}
