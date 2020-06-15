import { ERRORS } from '../constant.js'
import DISK from '../disk.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async ({ id, pwd }, { koa_context }) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [user] = await DISK.User({
    type  : DISK.GET,
    filter: { uuids: [bearer.uuid] },
    fields: ['superadmin'],
  })

  if (!user.superadmin) throw new GraphQLError(ERRORS.UNAUTHORIZED)

  await DISK.User({
    type  : DISK.SET,
    filter: { uuids: [id] },
    fields: { hash: await bcrypt.hash(pwd, 10) },
  })

  return true
}
