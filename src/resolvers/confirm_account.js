import { ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async (_, { koa_context, Disk }) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  await Disk.SET.User({
    keys    : [bearer.uuid],
    limit   : 1,
    search  : '*',
    document: {
      verification_code: undefined,
      verified         : true,
    },
  })

  return true
}
