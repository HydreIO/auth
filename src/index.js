import { readFileSync } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

import Koa from 'koa'
import body_parser from 'koa-bodyparser'
import Router from 'koa-router'
import cors from '@koa/cors'
import { buildSchema, GraphQLError } from 'graphql/index.mjs'
import graphql_http from '@hydre/graphql-http/koa'
import Mount from '@hydre/disk'
import sync from '@hydre/disk/src/synchronize.js'
import Parser from 'ua-parser-js'
import crypto from 'crypto'
import Redis from 'ioredis'
import rootValue from './root.js'
import Token from './token.js'
import events from 'events'

import { ENVIRONMENT } from './constant.js'

const {
  PORT,
  GRAPHQL_PATH,
  SERVER_HOST,
  ORIGINS,
  REDIS_HOST,
  REDIS_PORT,
  REDIS_SENTINEL_HOST,
  REDIS_SENTINEL_PORT,
  REDIS_MASTER_NAME,
} = ENVIRONMENT
const retryStrategy = label => attempt => {
  /* c8 ignore next 6 */
  // no testing of redis reconnection
  console.warn(`[${ label }] Unable to reach redis, retrying.. [${ attempt }]`)
  if (attempt > 10)
    return new Error(`Can't connect to redis after ${ attempt } tries..`)
  return 250 * 2 ** attempt
}
const slave_client = new Redis({
  host         : REDIS_HOST,
  port         : REDIS_PORT,
  retryStrategy: retryStrategy('slave'),
})
/* c8 ignore next 13 */
// not testing sentinels
const master_client = REDIS_SENTINEL_HOST
  ? new Redis({
    sentinels: [
      {
        host: REDIS_SENTINEL_HOST,
        port: REDIS_SENTINEL_PORT,
      },
    ],
    name                 : REDIS_MASTER_NAME,
    sentinelRetryStrategy: retryStrategy('sentinel'),
  })
  : slave_client
const log_all = (client, label) => {
  client.on('connect', () => {
    console.log(label, 'connect')
  })
  client.on('ready', () => {
    console.log(label, 'ready')
  })
  client.on('error', () => {
    console.log(label, 'error')
  })
  client.on('close', () => {
    console.log(label, 'close')
  })
  client.on('reconnecting', () => {
    console.log(label, 'reconnecting')
  })
  client.on('end', () => {
    console.log(label, 'end')
  })
}

log_all(master_client, 'master')
log_all(slave_client, 'slave')

console.log('await ready')
/* c8 ignore next 2 */
// not testing sentinels
if (REDIS_SENTINEL_HOST) await events.once(master_client, 'ready')
await events.once(slave_client, 'ready')
console.log('=============== all ready')
await sync(master_client, readFileSync('./src/schema.gql', 'utf-8'), 10, true)

const directory = dirname(fileURLToPath(import.meta.url))
const schema = readFileSync(`${ directory }/schema.gql`, 'utf8')
const router = new Router()
    .get('/healthz', context => {
      context.body = 'ok'
    })
    .all(
        GRAPHQL_PATH,
        graphql_http({
          schema     : buildSchema(schema),
          rootValue,
          formatError: error => {
            if (error?.originalError?.name === 'GraphQLError')
              return new GraphQLError(error.message)
            /* c8 ignore next 3 */
            // no testing of internal errors, they should not happen
            console.error(error)
            return new GraphQLError('Internal server error.. :(')
          },
          buildContext: async context => {
            return {
              build_session: () => {
                const { headers } = context.req
                const { 'user-agent': ua, 'x-forwarded-for': ip } = headers
                const parser = new Parser(ua || '')
                const { name: browserName } = parser.getBrowser()
                const {
                  model: deviceModel,
                  type: deviceType,
                  vendor: deviceVendor,
                } = parser.getDevice()
                const { name: osName } = parser.getOS()
                const sessionFields = {
                  ip,
                  browserName,
                  deviceModel,
                  deviceType,
                  deviceVendor,
                  osName,
                }

                return {
                  ...sessionFields,
                  hash: crypto
                      .createHash('md5')
                      .update(JSON.stringify(sessionFields))
                      .digest('hex'),
                }
              },
              Disk: Mount({
                master_client,
                slave_client,
                events_enabled: true,
                events_name   : '__disk__',
              }),
              sanitize: input =>
                input.replaceAll(/[!"#$%&'()*+,.:;<=>?@[\\\]^{|}~]/g, '\\$&'),
              koa_context : context,
              force_logout: () => {
                Token(context).rm()
              },
            }
          },
        }),
    )
const http_server = new Koa()
    .use(cors({
      /* c8 ignore next 11 */
      // no cors testing
      origin: ({
        req: {
          headers: { origin },
        },
      }) => {
        const [found] = ORIGINS.split(';').filter(x => origin.match(x))

        if (found) return origin
        return ''
      },
      allowMethods: ['POST', 'GET'],
      credentials : true,
    }))
    .use(body_parser())
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(
        {
          port: +PORT,
          host: SERVER_HOST,
        },
        () => {
          const base = `https://${ SERVER_HOST }:${ PORT }`

          console.log(`
    :: Authentication online 🔒 ${ base }${ GRAPHQL_PATH }
    :: Liveness probe online 💙 ${ base }/healthz
      `)
        },
    )

http_server.on('close', () => {
  /* c8 ignore next 2 */
  // not testing sentinel
  if (REDIS_SENTINEL_HOST) master_client.quit()
  slave_client.quit()
})

export default http_server
