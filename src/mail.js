import zmq from 'zeromq'
import { ENVIRONMENT, ERRORS } from './constant.js'
import { GraphQLError } from 'graphql/index.mjs'

const sock = new zmq.Push({ sendTimeout: 300 })
const { SOCKET_NOTIFIER_ADDRESS } = ENVIRONMENT
const send = async payload => {
  try {
    await sock.send(payload)
  } catch (error) {
    console.error(('[socket]', error))
    throw new GraphQLError(ERRORS.MAIL_SERVICE_OFFLINE)
  }
}

await sock.bind(SOCKET_NOTIFIER_ADDRESS)

export default {
  ACCOUNT_CREATE : 'ACCOUNT_CREATE',
  ACCOUNT_INVITE : 'ACCOUNT_INVITE',
  ACCOUNT_CONFIRM: 'ACCOUNT_CONFIRM',
  PASSWORD_RESET : 'PASSWORD_RESET',
  send,
}
