import MAIL from '../mail.js'
import { ENVIRONMENT, ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'

export default async ({ mail }, { Disk, sanitize }) => {
  const [user] = await Disk.GET.User({
    search: `@mail:{${ sanitize(mail) }}`,
    limit : 1,
    fields: ['last_verification_code_sent'],
  })

  if (user) {
    const { last_verification_code_sent } = user
    const { CONFIRM_ACCOUNT_DELAY } = ENVIRONMENT

    if (last_verification_code_sent + CONFIRM_ACCOUNT_DELAY > Date.now())
      throw new GraphQLError(ERRORS.SPAM)

    const verification_code = [...new Array(64)]
        .map(() => (~~(Math.random() * 36)).toString(36))
        .join('')

    await MAIL.send([MAIL.ACCOUNT_CONFIRM, user.uuid, mail, verification_code])
    await Disk.SET.User({
      keys    : [user.uuid],
      limit   : 1,
      search  : '*',
      document: {
        verification_code,
        last_verification_code_sent: Date.now(),
      },
    })
  }

  return true
}
