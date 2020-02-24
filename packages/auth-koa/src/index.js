import Koa from 'koa'
import cors from '@koa/cors'
import { createContext, schema, events, EVENTS, formatError } from '@hydre/auth-core'
import apolloServer from 'apollo-server-koa'
import Debug from 'debug'

const { ApolloServer, ApolloError } = apolloServer

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
  ORIGINS = '.*localhost:.+', // supported origins (regex)
  DATABASE, // db name
  MONGO_URI, // mongo host (if using mongo datasource)
  COLLECTION, // auth collection name
  REDIS_URI,
  GRAPH_NAME,
  PUB_KEY, // ES512
  PRV_KEY, // ES512
  REFRESH_TOKEN_SECRET, // secret string
  GOOGLE_ID, // google app id (sso)
  ALLOW_REGISTRATION, // can we register ?
  PWD_REGEX, // accept which type of pwd
  EMAIL_REGEX, // accept wich type of mail
  ACCESS_COOKIE_NAME, // name of the accessToken cookie (share this with your others services)
  REFRESH_COOKIE_NAME, // refresh cookie name (only used by auth)
  COOKIE_DOMAIN, // domain for the refresh
  RESET_PASS_DELAY, // ms between two pwd reset code request
  CONFIRM_ACCOUNT_DELAY, // ms between two verification code request,
  INVITE_USER_DELAY, // ms between two user invitation
  ACCESS_TOKEN_EXPIRATION, // ms before access token expiration
  PLAYGROUND = false, // graphql playground
  DATASOURCE = 'MONGO' // db type
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
  ALLOW_REGISTRATION: ALLOW_REGISTRATION.toLowerCase() === 'true',
  PWD_REGEX: new RegExp(PWD_REGEX),
  EMAIL_REGEX: new RegExp(EMAIL_REGEX),
  RESET_PASS_DELAY: +RESET_PASS_DELAY,
  CONFIRM_ACCOUNT_DELAY: +CONFIRM_ACCOUNT_DELAY,
  INVITE_USER_DELAY: +INVITE_USER_DELAY
}

// #################
// Options
// -----------------

const connector = async src => {
  switch (src) {
    case 'MONGO':
      const MongoConnector = await import('@hydre/datas-mongo')
      return MongoConnector({ uri: MONGO_URI, collection: COLLECTION, db: DATABASE })
    case 'REDISGRAPH':
      const { default: RedisGraphConnector } = await import('@hydre/datas-redisgraph')
      return RedisGraphConnector({ uri: REDIS_URI, graph: GRAPH_NAME })
    case 'NEO4J':
      const Neo4jConnector = await import('@hydre/datas-neo4j')
      return Neo4jConnector({ uri: NEO4J_URI })
    default:
      throw new Error('no datasrouce defined, please provide a DATASOURCE en variable.\nhttps://docs.auth.hydre.io/#/koa/?id=environement')
  }
}

const addCookie = ctx => serialized => {
  const [name, ...value] = serialized.split('=')
  ctx.cookies.set(name, value.join('='))
}

const corsOpt = {
  origin: ({ req: { headers: { origin } } }) => ORIGINS.split(';').reduce((a, b) => a || !!origin.match(b), '') && origin,
  credentials: true
}

// #################
// Middlewares
// -----------------

const parsed = body => { try { return JSON.parse(body) } catch { return body } }
const loggerMiddleware = async (ctx, next) => {
  await next()
  if (ctx.introspection) logResponse('Introspection result (hidden)')
  else logResponse.extend(ctx.status)('%o', parsed(ctx.body))
}

// #################
// Server
// -----------------

void async function() {
  const { connect, crud } = await connector(DATASOURCE)

  const serverOpt = {
    schema,
    context: ({ ctx }) => {
      logDate(new Date().toLocaleString())
      const { query = '' } = ctx.request.body
      ctx.introspection = !!query.includes('__schema')
      if (!ctx.introspection) logIncommingQuery(query)
      else logIncommingQuery('Introspection query (hidden)')
      return createContext({
        env: {
          ...env,
          IP: ctx.request.ip
        },
        crud,
        event: { headers: ctx.headers, addCookie: addCookie(ctx) }
      })
    },
    playground: PLAYGROUND,
    formatError
  }

  debug('loading..')
  await connect()
  events.on(EVENTS.CONFIRM_EMAIL, a => { debug('Confirm mail %O', a) })
  events.on(EVENTS.INVITE_USER, a => { debug('Invite user %O', a) })
  events.on(EVENTS.RESET_PWD, a => { debug('Reset pwd %O', a) })
  new Koa()
    .use(cors(corsOpt))
    .use(loggerMiddleware)
    .use(new ApolloServer(serverOpt).getMiddleware({ path: '/' }))
    .listen(PORT, () => debug(`Now online! (:${PORT})`))
}()