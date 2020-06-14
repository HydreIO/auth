import zmq from 'zeromq'
import Debug from 'debug'
import { EVENTS } from '../utils/constant'
import { MailNotSentError } from '../../graphql/errors'

const logZmq = Debug('auth').extend('ømq')
const logNotifier = logZmq.extend('notifier')
const logHealth = logZmq.extend('health')
const sock = new zmq.Push({ sendTimeout: 300 })
const healthSock = new zmq.Stream()
const { CONFIRM_EMAIL, INVITE_USER, RESET_PWD } = EVENTS

export const notifier = async socketAddress => {
  logNotifier('binding on %s', socketAddress)
  await sock.bind(socketAddress)
  logNotifier('socket bound')

  const send = async (key, datas) => {
    logNotifier('sending %O : %O', key, datas)
    try {
      await sock.send([key, ...datas])
      logNotifier('socket sent')
    } catch (error) {
      console.error(error)
      throw new MailNotSentError()
    }
  }
  return {
    notifyInviteUser: async ({ from, to, code }) =>
      send(INVITE_USER, [from, to, code]),
    notifyConfirmEmail: async ({ to, code }) => send(CONFIRM_EMAIL, [to, code]),
    notifyResetPwd: async ({ to, code }) => send(RESET_PWD, [to, code]),
  }
}

export const healthCheck = socketAddress => ({
  start: async () => {
    logHealth('binding on %s', socketAddress)
    await healthSock.bind(socketAddress)
    logHealth('socket bound')
  },
  stop: async () => {
    logHealth('unbinding from %s', socketAddress)
    await healthSock.unbind(socketAddress)
    logHealth('socket unbound')
  },
})
