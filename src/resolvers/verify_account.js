import { ERRORS } from '../constant.js'
import DISK from '../disk.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async (_, { koa_context }) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  await DISK.User({
    type  : DISK.SET,
    filter: { uuids: [bearer.uuid] },
    fields: {
      verification_code: undefined,
      verified         : true,
    },
  })

  return true
}
