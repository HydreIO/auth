import { ERRORS, ENVIRONMENT } from '../constant.js'
import MAIL from '../mail.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async ({ mail, payload }, { koa_context, Disk, sanitize }) => {
  if (!ENVIRONMENT.ALLOW_REGISTRATION)
    throw new GraphQLError(ERRORS.REGISTRATION_DISABLED)

  if (!mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [invited_id] = await Disk.KEYS.User({
    search: `@mail:{${ sanitize(mail) }}`,
    limit : 1,
  })

  if (invited_id) throw new GraphQLError(ERRORS.MAIL_USED)

  const uuid = await Disk.CREATE.User({
    document: {
      mail,
      // verified because the invitation already prove the mail identity
      verified                   : true,
      sessions                   : JSON.stringify([]),
      last_reset_code_sent       : 0,
      last_verification_code_sent: 0,
    },
  })

  await MAIL.send([MAIL.ACCOUNT_INVITE, bearer.uuid, uuid, payload, mail])
  return true
}
