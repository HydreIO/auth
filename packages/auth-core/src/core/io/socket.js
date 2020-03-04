import zmq from 'zeromq'
import Debug from 'debug'
import { EVENTS } from '../utils/constant'
import { MailNotSentError } from '../../graphql/errors'
import rxjs from 'rxjs'
import operators from 'rxjs/operators'

const { Subject, from } = rxjs
const { concatMap } = operators

const logZmq = Debug('auth').extend('ømq')
const sock = new zmq.Push({ sendTimeout: 300 })
const { CONFIRM_EMAIL, INVITE_USER, RESET_PWD } = EVENTS

export default async socketAdress => {
  logZmq('binding on %s', socketAdress)
  await sock.bind(socketAdress)
  logZmq('socket bound')

  const subject$ = new Subject().pipe(concatMap(([res, rej, ...msg]) => from(sock.send(msg).then(res).catch(rej))))
  subject$.subscribe(() => logZmq('socket sent'))

  const send = async (key, datas) => {
    logZmq('sending %O : %O', key, datas)
    try {
      return await new Promise((res, rej) => {
        subject$.next([res, rej, key, ...datas])
      })
    } catch (error) {
      console.error(error)
      throw new MailNotSentError()
    }
  }
  return {
    notifyInviteUser: async ({ from, to, code }) => send(INVITE_USER, [from, to, code]),
    notifyConfirmEmail: async ({ to, code }) => send(CONFIRM_EMAIL, [to, code]),
    notifyResetPwd: async ({ to, code }) => send(RESET_PWD, [to, code])
  }
}

