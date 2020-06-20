import { ERRORS, ENVIRONMENT } from '../constant.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql/index.mjs'
import MAIL from '../mail.js'

export default async ({ mail, pwd }, { Disk, sanitize }) => {
  if (!ENVIRONMENT.ALLOW_REGISTRATION)
    throw new GraphQLError(ERRORS.REGISTRATION_DISABLED)

  if (!mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  const [user_id] = await Disk.KEYS.User({
    search: `@mail:{${ sanitize(mail) }}`,
    limit : 1,
  })

  if (user_id) throw new GraphQLError(ERRORS.MAIL_USED)

  const verification_code = [...new Array(64)]
      .map(() => (~~(Math.random() * 36)).toString(36))
      .join('')
  const uuid = await Disk.CREATE.User({
    document: {
      mail,
      verification_code,
      hash                       : pwd ? await bcrypt.hash(pwd, 10) : undefined,
      verified                   : false,
      sessions                   : JSON.stringify([]),
      last_reset_code_sent       : 0,
      last_verification_code_sent: Date.now(),
    },
  })

  await MAIL.send([MAIL.ACCOUNT_CREATE, uuid, mail, verification_code])
  return true
}
