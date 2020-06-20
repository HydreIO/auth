import { ERRORS } from '../constant.js'
import { extract_fields } from 'graphql-extract'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async (_, { koa_context, Disk }, me_infos) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [user] = await Disk.GET.User({
    keys  : [bearer.uuid],
    search: '*',
    fields: extract_fields(me_infos),
    limit : 1,
  })

  return {
    ...user,
    sessions: async (__, ___, s_infos) =>
      Disk.GET.Session({
        keys  : JSON.parse(user.sessions) ?? [],
        search: '*',
        fields: extract_fields(s_infos),
      }),
  }
}
