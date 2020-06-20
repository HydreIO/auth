import { ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async ({ id }, { koa_context, Disk }) => {
  const token = Token(koa_context)
  const bearer = token.get()
  const remove = () => {
    token.rm()
    return true
  }

  if (!bearer.uuid) return remove()

  const [user] = await Disk.GET.User({
    keys  : [bearer.uuid],
    search: '*',
    limit : 1,
    fields: ['sessions'],
  })

  // particular case where an user would have been deleted
  // while still being logged
  if (!user) return remove()

  const sessions = new Set(JSON.parse(user.sessions))
  const ended_session_id = id ?? bearer.session

  if (!sessions.has(ended_session_id))
    throw new GraphQLError(ERRORS.ILLEGAL_SESSION)

  sessions.delete(ended_session_id)

  await Disk.SET.User({
    keys    : [bearer.uuid],
    limit   : 1,
    search  : '*',
    document: { sessions: JSON.stringify([...sessions.values()]) },
  })

  await Disk.DELETE.Session({
    search: '*',
    keys  : [ended_session_id],
  })
  return true
}
