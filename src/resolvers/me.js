import { ERRORS } from '../constant.js'
import { extract_fields } from 'graphql-extract'
import DISK from '../disk.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async (_, { koa_context }, me_infos) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [user] = await DISK.User({
    type  : DISK.GET,
    filter: { uuids: [bearer.uuid] },
    fields: extract_fields(me_infos),
  })

  return {
    ...user,
    sessions: async (__, ___, s_infos) =>
      DISK.Session({
        type  : DISK.GET,
        uuids : user.sessions,
        fields: extract_fields(s_infos),
      }),
  }
}
