import { ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'

const DAY = 86400000

export default async ({ code }, { koa_context, Disk, force_logout }) => {
  const bearer = Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const [user] = await Disk.GET.User({
    keys  : [bearer.uuid],
    limit : 1,
    fields: ['verification_code', 'last_verification_code_sent'],
  })

  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  // codes expire after a day
  if (
    user.verification_code !== code
    || user.last_verification_code_sent + DAY < Date.now()
  )
    throw new GraphQLError(ERRORS.INVALID_CODE)
  await Disk.SET.User({
    keys    : [bearer.uuid],
    limit   : 1,
    document: {
      verification_code: undefined,
      verified         : true,
    },
  })
  return true
}
