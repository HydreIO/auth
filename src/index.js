import { readFileSync } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

import Koa from 'koa'
import body_parser from 'koa-bodyparser'
import Router from 'koa-router'
import cors from '@koa/cors'
import { buildSchema } from 'graphql/index.mjs'
import graphql_http from '@hydre/graphql-http/koa'
import Mount from '@hydre/disk'
import Parser from 'ua-parser-js'
import crypto from 'crypto'
import redis from 'redis'
import rootValue from './root.js'

import { ENVIRONMENT } from './constant.js'

redis.addCommand('FT.ADD')
redis.addCommand('FT.SEARCH')
redis.addCommand('FT.CREATE')
redis.addCommand('FT.DEL')

const {
  PORT,
  GRAPHQL_PATH,
  SERVER_HOST,
  ORIGINS,
  REDIS_URL,
} = ENVIRONMENT
const client = redis.createClient({
  url           : REDIS_URL,
  retry_strategy: ({ attempt }) => {
    console.warn(`Unable to reach redis instance, retrying.. [${ attempt }]`)
    if (attempt > 10)
      return new Error(`Can't connect to redis after ${ attempt } tries..`)
    return 250 * 2 ** attempt
  },
})

await new Promise(resolve => {
  client.on('ready', resolve)
})

const directory = dirname(fileURLToPath(import.meta.url))
const schema = readFileSync(`${ directory }/schema.gql`, 'utf8')
const router = new Router()
    .get('/healthz', context => {
      context.body = 'ok'
    })
    .all(
        GRAPHQL_PATH,
        graphql_http({
          schema      : buildSchema(schema),
          rootValue,
          buildContext: async context => {
            return {
              build_session: () => {
                const { headers } = context.req
                const {
                  'user-agent': user_agent,
                  'x-forwarded-for': ip,
                } = headers
                const parser = new Parser(user_agent ?? '')
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
                client,
                events_enabled: true,
                events_name   : '__disk__',
              }),
              sanitize: input => input
                  .replaceAll(/[!"#$%&'()*+,.:;<=>?@[\\\]^{|}~]/g, '\\$&'),
            }
          },
        }),
    )

new Koa()
    .use(cors({
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
