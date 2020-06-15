import { ERRORS, ENVIRONMENT } from '../constant.js'
import DISK from '../disk.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql/index.mjs'
import MAIL from '../mail.js'

export default async ({ mail, pwd }) => {
  if (!ENVIRONMENT.ALLOW_REGISTRATION)
    throw new GraphQLError(ERRORS.REGISTRATION_DISABLED)

  if (!mail || !mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  if (pwd && !pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  const user_exist = await DISK.User({
    type : DISK.EXIST,
    match: { mail },
  })

  if (user_exist) throw new GraphQLError(ERRORS.MAIL_USED)

  const verification_code = await MAIL[pwd ? 'verify' : 'verify_reset'](mail)

  await DISK.User({
    type  : DISK.CREATE,
    fields: {
      mail,
      hash                       : pwd ? await bcrypt.hash(pwd, 10) : undefined,
      verified                   : false,
      verification_code,
      sessions                   : [],
      last_reset_code_sent       : 0,
      last_verification_code_sent: Date.now(),
    },
  })
  return true
}
