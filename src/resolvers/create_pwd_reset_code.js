import MAIL from '../mail.js'
import { ENVIRONMENT, ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'

export default async ({ mail }, { Disk, sanitize }) => {
  const [user] = await Disk.GET.User({
    search: `@mail:{${ sanitize(mail) }}`,
    fields: ['last_reset_code_sent', 'uuid'],
    limit : 1,
  })

  if (user) {
    const { last_reset_code_sent } = user
    const { RESET_PASS_DELAY } = ENVIRONMENT

    if (last_reset_code_sent + RESET_PASS_DELAY > Date.now())
      throw new GraphQLError(ERRORS.SPAM)

    const reset_code = [...new Array(64)]
        .map(() => (~~(Math.random() * 36)).toString(36))
        .join('')

    await MAIL.send([MAIL.PASSWORD_RESET, user.uuid, mail, reset_code])
    await Disk.SET.User({
      keys    : [user.uuid],
      limit   : 1,
      document: {
        reset_code,
        last_reset_code_sent: Date.now(),
      },
    })
  }

  return true
}
