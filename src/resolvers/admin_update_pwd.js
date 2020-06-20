import { ERRORS } from '../constant.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async ({ id, pwd }, { koa_context, Disk }) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [user] = await Disk.GET.User({
    keys  : [bearer.uuid],
    search: '*',
    limit : 1,
    fields: ['superadmin'],
  })

  if (!user.superadmin) throw new GraphQLError(ERRORS.UNAUTHORIZED)

  await Disk.SET.User({
    keys    : [id],
    search  : '*',
    limit   : 1,
    document: { hash: await bcrypt.hash(pwd, 10) },
  })

  return true
}
