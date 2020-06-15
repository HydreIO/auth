import { ERRORS } from '../constant.js'
import DISK from '../disk.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async ({ id }, { koa_context }) => {
  const token = Token(koa_context)
  const bearer = token.get()
  const remove = () => {
    token.rm()
    return true
  }

  if (!bearer.uuid) return remove()

  const [user] = await DISK.User({
    type  : DISK.GET,
    filter: { uuids: [bearer.uuid] },
    fields: ['sessions'],
  })

  // particular case where an user would have been deleted
  // while still being logged
  if (!user) return remove()

  const sessions = new Set(user.sessions)
  const ended_session_id = id ?? bearer.session

  if (!sessions.has(ended_session_id))
    throw new GraphQLError(ERRORS.ILLEGAL_SESSION)

  sessions.delete(ended_session_id)

  await DISK.User({
    type  : DISK.SET,
    filter: { uuids: [bearer.uuid] },
    fields: { sessions: [...sessions.values()] },
  })

  await DISK.Session({
    type  : DISK.DELETE,
    filter: { uuids: [ended_session_id] },
  })
  return true
}
