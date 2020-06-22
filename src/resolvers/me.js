import { ERRORS } from '../constant.js'
import { extract_fields } from 'graphql-extract'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async (_, { koa_context, Disk, force_logout }, me_infos) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [user] = await Disk.GET.User({
    keys  : [bearer.uuid],
    fields: extract_fields(me_infos),
    limit : 1,
  })

  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  return {
    ...user,
    sessions: async (__, ___, s_infos) =>
      Disk.GET.Session({
        keys  : JSON.parse(user.sessions) ?? [],
        fields: extract_fields(s_infos),
      }),
  }
}
