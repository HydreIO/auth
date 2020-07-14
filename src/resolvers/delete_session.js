import Token from '../token.js'

export default async ({ id }, { koa_context, Graph, force_logout }) => {
  const token = Token(koa_context)
  const bearer = token.get()

  if (!bearer.uuid) {
    force_logout()
    return true
  }

  const [{ user } = {}] = await Graph.run`
  MATCH (user:User { uuid: ${ bearer.uuid }}) RETURN DISTINCT user`

  // particular case where an user would have been deleted
  // while still being logged
  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    return true
  }

  // logout if the id is not provied
  if (!id) force_logout()

  await Graph.run`
  MATCH (u:User)-[:HAS_SESSION]->(s:Session)
  WHERE u.uuid = ${ bearer.uuid } AND s.uuid = ${ id ?? bearer.session }
  DELETE s
  `

  return true
}
