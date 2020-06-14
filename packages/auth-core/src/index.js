import { buildContext } from './core/context'
import { EVENTS } from './core/utils/constant'
import { notifier, healthCheck } from './core/io/socket'
import schema from './graphql/index'
import { formatError } from './graphql/errors'
import Koa from 'koa'
import cors from '@koa/cors'
import apolloKoa from 'apollo-server-koa'
import Debug from 'debug'

// #################
// Loggers
// -----------------
const debug = Debug('auth').extend('koa')
const logIncommingQuery = debug.extend('<-').extend('|')
const logError = debug.extend('err')
const logResponse = debug.extend('->')
const logDate = debug.extend('time')

// #################
// Variables
// -----------------
const {
  PORT = 3000, // app port
  ORIGINS = '*', // supported origins (regex)
  PUB_KEY = '-----BEGIN PUBLIC KEY-----\nMIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQAaW4NpvoFJ6r0q4Cg5y4V9fTkk/RM\n+XYzFWST7bOog8k/5TBYvEHZoyHpsI/9KSQ6Bk0cjCeR9HuUvUW/PTQPu6YB61Wh\nwPVCjYEZKjPLiVJvo44Ck4fada/CBuSgwdTviU+SFUTU1v/nOy89IMjF4Wa0QjXw\ndL2UmIx6GiXqQYebdxw=\n-----END PUBLIC KEY-----', // ES512
  PRV_KEY = '-----BEGIN EC PRIVATE KEY-----\nMIHcAgEBBEIAumGgZ9d0sD4A1Ch6vLWcF2ryd7o49Mz7F/bEHjYZcMRopsazPXzs\nDj+wZzoqCYE2uEXcl+1kS/hBsubqwZ+kLD+gBwYFK4EEACOhgYkDgYYABABpbg2m\n+gUnqvSrgKDnLhX19OST9Ez5djMVZJPts6iDyT/lMFi8QdmjIemwj/0pJDoGTRyM\nJ5H0e5S9Rb89NA+7pgHrVaHA9UKNgRkqM8uJUm+jjgKTh9p1r8IG5KDB1O+JT5IV\nRNTW/+c7Lz0gyMXhZrRCNfB0vZSYjHoaJepBh5t3HA==\n-----END EC PRIVATE KEY-----', // ES512
  REFRESH_TOKEN_SECRET = '63959228FC8584C314ETGVC7H2441', // secret string
  GOOGLE_ID = 'xxxx.apps.googleusercontent.com`', // google app id (sso)
  ALLOW_REGISTRATION = true, // can we register ?
  PWD_REGEX = /^(?!.*[\s])(?=.*[a-zA-Z])(?=.*[0-9])(?=.{6,32})/, // accept which type of pwd
  EMAIL_REGEX = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/, // accept wich type of mail
  ACCESS_COOKIE_NAME = 'another-cookie-name', // name of the accessToken cookie (share this with your others services)
  REFRESH_COOKIE_NAME = 'a-cookie-name', // refresh cookie name (only used by auth)
  COOKIE_DOMAIN = '.dev.local', // domain for the refresh
  RESET_PASS_DELAY = '5s', // zeit/ms between two pwd reset code request
  CONFIRM_ACCOUNT_DELAY = '5s', // zeit/ms between two verification code request,
  INVITE_USER_DELAY = '5s', // zeit/ms between two user invitation
  ACCESS_TOKEN_EXPIRATION = '20m', // ms before access token expiration
  PLAYGROUND = false, // graphql playground
  SOCKET_NOTIFIER_ADDRESS = 'tcp://0.0.0.0:3001',
  SOCKET_HEALTH_ADDRESS = 'tcp://0.0.0.0:3002',
  GRAPHQL_PATH = '/',
} = process.env

const env = {
  PUB_KEY,
  PRV_KEY,
  REFRESH_TOKEN_SECRET,
  GOOGLE_ID,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  COOKIE_DOMAIN,
  ACCESS_TOKEN_EXPIRATION,
  ALLOW_REGISTRATION: `${ALLOW_REGISTRATION}`.toLowerCase() === 'true',
  PWD_REGEX: new RegExp(PWD_REGEX),
  EMAIL_REGEX: new RegExp(EMAIL_REGEX),
  RESET_PASS_DELAY,
  CONFIRM_ACCOUNT_DELAY,
  INVITE_USER_DELAY,
}

// #################
// Options
// -----------------
const addCookie = ctx => serialized => {
  const [name, ...value] = serialized.split('=')
  ctx.cookies.set(name, value.join('='))
}

const corsOpt = {
  origin: ({
    req: {
      headers: { origin },
    },
  }) =>
    ORIGINS.split(';').reduce((a, b) => a || !!origin.match(b), '') && origin,
  credentials: true,
}

// #################
// Middlewares
// -----------------

const parsed = body => {
  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}
const loggerMiddleware = async (ctx, next) => {
  await next()
  if (ctx.introspection) logResponse('Introspection result (hidden)')
  else logResponse.extend(ctx.status)('%o', parsed(ctx.body))
}

// #################
// Server
// -----------------
export default async crud => {
  debug('loading..')

  const socketOps = await notifier(SOCKET_NOTIFIER_ADDRESS)
  const health_check = healthCheck(SOCKET_HEALTH_ADDRESS)

  const serverOpt = {
    schema,
    context: ({ ctx }) => {
      logDate(new Date().toLocaleString())
      const { query = '' } = ctx.request.body
      ctx.introspection = !!query.includes('__schema')
      if (!ctx.introspection) logIncommingQuery(query)
      else logIncommingQuery('Introspection query (hidden)')
      return buildContext({
        env: { ...env, IP: ctx.request.ip },
        crud,
        event: {
          headers: ctx.headers,
          addCookie: addCookie(ctx),
        },
        socketOps,
      })
    },
    playground: PLAYGROUND,
    formatError,
  }

  new Koa()
    .use(cors(corsOpt))
    .use(loggerMiddleware)
    .use(
      new apolloKoa.ApolloServer(serverOpt).getMiddleware({
        path: GRAPHQL_PATH,
      })
    )
    .listen(+PORT, () =>
      debug(`🚀 Now online! (0.0.0.0:${+PORT}${GRAPHQL_PATH})`)
    )

  // ready to accept queries
  setTimeout(health_check.start, 1000)
}
