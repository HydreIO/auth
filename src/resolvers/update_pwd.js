import { ERRORS, ENVIRONMENT } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import bcrypt from 'bcryptjs'

const DAY = 86400000

export default async ({ code, mail, pwd }, { Disk, sanitize }) => {
  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  const [user] = await Disk.GET.User({
    search: `@mail:{${ sanitize(mail) }}`,
    limit : 1,
    fields: ['mail', 'reset_code', 'last_reset_code_sent'],
  })

  if (!user) throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  if (user.reset_code !== code || user.last_reset_code_sent + DAY < Date.now())
    throw new GraphQLError(ERRORS.INVALID_CODE)

  await Disk.SET.User({
    keys    : [user.uuid],
    search  : '*',
    limit   : 1,
    document: {
      reset_code: undefined,
      hash      : await bcrypt.hash(pwd, 10),
    },
  })

  return true
}
