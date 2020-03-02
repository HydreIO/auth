import zmq from 'zeromq'
import Debug from 'debug'
import { EVENTS } from '../utils/constant'

const logZmq = Debug('auth').extend('ømq')
const sock = new zmq.Push
const { CONFIRM_EMAIL, INVITE_USER, RESET_PWD } = EVENTS

export default async socketAdress => {
  logZmq('binding on %s', socketAdress)
  await sock.bind(socketAdress)
  logZmq('socket bound')

  const send = async (key, datas) => {
    logZmq('sending %O : %O', key, datas)
    return sock.send([key, ...datas])
  }
  return {
    notifyInviteUser: async ({ from, to, code }) => send(INVITE_USER, [from, to, code]),
    notifyConfirmEmail: async ({ to, code }) => send(CONFIRM_EMAIL, [to, code]),
    notifyResetPwd: async ({ to, code }) => send(RESET_PWD, [to, code])
  }
}

