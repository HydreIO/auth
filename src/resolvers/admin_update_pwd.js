import { ERRORS } from '../constant.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async ({ id, pwd }, { koa_context, Disk, force_logout }) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [user] = await Disk.GET.User({
    keys  : [bearer.uuid],
    limit : 1,
    fields: ['superadmin'],
  })

  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  if (!user.superadmin) throw new GraphQLError(ERRORS.UNAUTHORIZED)

  await Disk.SET.User({
    keys    : [id],
    limit   : 1,
    document: { hash: await bcrypt.hash(pwd, 10) },
  })

  return true
}
