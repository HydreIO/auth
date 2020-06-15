import DISK from '../disk.js'
import { ERRORS, ENVIRONMENT } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import bcrypt from 'bcryptjs'

const DAY = 86400000

export default async ({ code, mail, pwd }) => {
  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  const [user] = await DISK.User({
    type  : DISK.GET,
    match : { mail },
    fields: ['reset_code', 'last_reset_code_sent'],
  })

  if (!user) throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  if (user.reset_code !== code || user.last_reset_code_sent + DAY < Date.now())
    throw new GraphQLError(ERRORS.INVALID_CODE)

  await DISK.User({
    type  : DISK.SET,
    filter: { uuids: [user.uuid] },
    fields: {
      reset_code: undefined,
      hash      : await bcrypt.hash(pwd, 10),
    },
  })

  return true
}
