import { ERRORS, ENVIRONMENT } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'
import jwt from 'jsonwebtoken'

const is_token_valid = (token, valid_uuid) => {
  try {
    const { uuid } = jwt.verify(token, ENVIRONMENT.PUBLIC_KEY, {
      algorithms: 'ES512',
    })

    return uuid === valid_uuid
  } catch {
    return false
  }
}

export default async ({ code }, { koa_context, Graph, force_logout }) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [{ user } = {}] = await Graph.run/* cypher */`
  MATCH (user:User { uuid: ${ bearer.uuid }}) RETURN DISTINCT user`

  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  // codes expire after a day
  if (!is_token_valid(code, bearer.uuid))
    throw new GraphQLError(ERRORS.INVALID_CODE)

  await Graph.run/* cypher */`
    MATCH (u:User)
    WHERE u.uuid = ${ bearer.uuid }
    SET u.verified = true
    `
  return true
}
