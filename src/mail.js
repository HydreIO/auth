import zmq from 'zeromq'
import { ENVIRONMENT, ERRORS } from './constant.js'
import { GraphQLError } from 'graphql/index.mjs'

const sock = new zmq.Push({ sendTimeout: 300 })
const { SOCKET_NOTIFIER_ADDRESS } = ENVIRONMENT
const send = async (key, datas) => {
  try {
    await sock.send([key, ...datas])
  } catch {
    throw new GraphQLError(ERRORS.MAIL_SERVICE_OFFLINE)
  }
}

await sock.bind(SOCKET_NOTIFIER_ADDRESS)

export default new Proxy(sock, {
  get(target, action) {
    if (action === 'then') return undefined
    switch (action) {
      case 'reset':

        return async () => {
          await socket_ready()
        }

      case 'verify':
        break

      case 'verify_reset':
        break

      // no default
    }
  },
})
