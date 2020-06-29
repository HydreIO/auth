import { ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async ({ id }, { koa_context, Disk, force_logout }) => {
  const token = Token(koa_context)
  const bearer = token.get()

  console.dir(bearer, {
    depth : Infinity,
    colors: true,
  })

  if (!bearer.uuid) {
    force_logout()
    return true
  }

  const [user] = await Disk.GET.User({
    keys  : [bearer.uuid],
    limit : 1,
    fields: ['sessions'],
  })

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

  const sessions = new Set(JSON.parse(user.sessions))
  const ended_session_id = id ?? bearer.session

  if (!sessions.has(ended_session_id))
    throw new GraphQLError(ERRORS.ILLEGAL_SESSION)

  sessions.delete(ended_session_id)

  await Disk.SET.User({
    keys    : [bearer.uuid],
    limit   : 1,
    document: { sessions: JSON.stringify([...sessions.values()]) },
  })

  await Disk.DELETE.Session({
    keys: [ended_session_id],
  })
  return true
}
