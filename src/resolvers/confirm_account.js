import { ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'
import { plus_equals } from '@hydre/rgraph/operators'

const DAY = 86400000

export default async ({ code }, { koa_context, Graph, force_logout }) => {
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

  // codes expire after a day
  if (
    user.verification_code !== code
    || user.last_verification_code_sent + DAY < Date.now()
  )
    throw new GraphQLError(ERRORS.INVALID_CODE)
  await Graph.run`
    MATCH (u:User)
    WHERE u.uuid = ${ bearer.uuid }
    SET ${ plus_equals('u', {
    verification_code: undefined,
    verified         : true,
  }) }
    `
  return true
}
