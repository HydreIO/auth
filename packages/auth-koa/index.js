import Koa from 'koa'
import cors from '@koa/cors'
import { ApolloServer } from 'apollo-server-koa'
import { createContext, schema, events, types, EVENTS, formatError } from '@hydre/auth-core'
import MongoConnector from '@hydre/auth-io-mongo'

const debug = require('debug')('auth').extend('koa')
const {
  PORT = 2020,
  ORIGINS = '.*localhost:.+',
  DATABASE, // db name
  MONGO_URI, // mongo host (atlas like)
  COLLECTION, // auth collection name
  ALLOW_REGISTRATION, // can we register ? (TRUE, FALSE) case sensitive
  PWD_REGEX, // accept which type of pwd
  EMAIL_REGEX, // accept wich type of email
  RESET_PASS_DELAY, // ms between two pwd reset code request
  CONFIRM_ACCOUNT_DELAY // ms between two verification code request
} = process.env

const { connect, crud } = MongoConnector({ uri: MONGO_URI, collection: COLLECTION, db: DATABASE })

const parseCookie = serialized => {
  const [name, ...value] = serialized.split('=')
  return [name, value.join('=')]
}

const context = ({ ctx }) => createContext({
  env: {
    ...process.env,
    ALLOW_REGISTRATION: ALLOW_REGISTRATION.toLowerCase() === 'true',
    PWD_REGEX: new RegExp(PWD_REGEX),
    EMAIL_REGEX: new RegExp(EMAIL_REGEX),
    RESET_PASS_DELAY: +RESET_PASS_DELAY,
    CONFIRM_ACCOUNT_DELAY: +CONFIRM_ACCOUNT_DELAY,
    IP: ctx.request.ip
  },
  crud,
  event: { headers: ctx.headers, addCookie: raw => ctx.cookies.set(...parseCookie(raw)) }
})

const corsOpt = {
  origin: ({ req: { headers: { origin } } }) => ORIGINS.split(';').reduce((a, b) => a || !!origin.match(b), '') && origin,
  credentials: true
}

void async function () {
  debug('loading..')
  await connect()
  events.on(EVENTS.CONFIRM_EMAIL, a => { debug('Confirm email %O', a) })
  events.on(EVENTS.INVITE_USER, a => { debug('Invite user %O', a) })
  events.on(EVENTS.RESET_PWD, a => { debug('Reset pwd %O', a) })
  new Koa()
    .use(cors(corsOpt))
    .use(new ApolloServer({ schema, context }).getMiddleware())
    .listen(PORT, () => debug(`Now online! (:${PORT})`))
}()