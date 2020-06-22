import { ERRORS, ENVIRONMENT } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import bcrypt from 'bcryptjs'
import Token from '../token.js'

const DAY = 86400000

export default async (
  { code, mail, pwd },
  { Disk, sanitize, force_logout, koa_context },
) => {
  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  if (!code) {
    // if no code is provided we assume the user is logged
    // and just wanna change his pwd.
    const bearer = Token(koa_context).get()

    if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

    const [user] = await Disk.GET.User({
      keys  : [bearer.uuid],
      fields: [],
      limit : 1,
    })

    /* c8 ignore next 5 */
    // redundant testing as the same code is already tested elsewhere
    if (!user) {
      force_logout()
      throw new GraphQLError(ERRORS.USER_NOT_FOUND)
    }

    await Disk.SET.User({
      keys    : [user.uuid],
      limit   : 1,
      document: { hash: await bcrypt.hash(pwd, 10) },
    })
    return true
  }

  const [user] = await Disk.GET.User({
    search: `@mail:{${ sanitize(mail) }}`,
    limit : 1,
    fields: ['reset_code', 'last_reset_code_sent'],
  })

  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  // codes expire after a day
  if (user.reset_code !== code || user.last_reset_code_sent + DAY < Date.now())
    throw new GraphQLError(ERRORS.INVALID_CODE)

  await Disk.SET.User({
    keys    : [user.uuid],
    limit   : 1,
    document: {
      reset_code: undefined,
      hash      : await bcrypt.hash(pwd, 10),
    },
  })

  return true
}
