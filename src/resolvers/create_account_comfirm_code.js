import MAIL from '../mail.js'
import { ENVIRONMENT, ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

export default async (_, { Disk, koa_context, force_logout }) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [user] = await Disk.GET.User({
    keys  : [bearer.uuid],
    limit : 1,
    fields: ['last_verification_code_sent', 'mail'],
  })

  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  const { last_verification_code_sent, mail, uuid } = user
  const { CONFIRM_ACCOUNT_DELAY } = ENVIRONMENT

  if (last_verification_code_sent + CONFIRM_ACCOUNT_DELAY > Date.now())
    throw new GraphQLError(ERRORS.SPAM)

  const verification_code = [...new Array(64)]
      .map(() => (~~(Math.random() * 36)).toString(36))
      .join('')

  await MAIL.send([MAIL.ACCOUNT_CONFIRM, uuid, mail, verification_code])
  await Disk.SET.User({
    keys    : [user.uuid],
    limit   : 1,
    document: {
      verification_code,
      last_verification_code_sent: Date.now(),
    },
  })

  return true
}
