import { ERRORS, ENVIRONMENT } from '../constant.js'
import DISK from '../disk.js'
import MAIL from '../mail.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'
import { v4 as uuid4 } from 'uuid'

export default async ({ mail, payload }, { koa_context }) => {
  if (!ENVIRONMENT.ALLOW_REGISTRATION)
    throw new GraphQLError(ERRORS.REGISTRATION_DISABLED)

  if (!mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const user_exist = await DISK.User({
    type : DISK.EXIST,
    match: { mail },
  })

  if (user_exist) throw new GraphQLError(ERRORS.MAIL_USED)

  const uuid = uuid4()

  await MAIL.send([MAIL.ACCOUNT_INVITE, bearer.uuid, uuid, payload, mail])
  await DISK.User({
    type  : DISK.CREATE,
    fields: {
      uuid,
      mail,
      // verified because the invitation already prove the mail identity
      verified                   : true,
      sessions                   : [],
      last_reset_code_sent       : 0,
      last_verification_code_sent: 0,
    },
  })
  return true
}
