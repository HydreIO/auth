import MAIL from '../mail.js'
import DISK from '../disk.js'
import { ENVIRONMENT, ERRORS } from '../constant.js'
import { GraphQLError } from 'graphql/index.mjs'

export default async ({ mail }) => {
  const [user] = await DISK.User({
    type  : DISK.GET,
    match : { mail },
    fields: ['last_verification_code_sent', 'uuid'],
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
    await DISK.User({
      type  : DISK.SET,
      filter: { uuids: [user.uuid] },
      fields: {
        verification_code,
        last_verification_code_sent: Date.now(),
      },
    })
  }

  return true
}
