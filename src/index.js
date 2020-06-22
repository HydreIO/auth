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
import redis from 'redis'
import rootValue from './root.js'
import Token from './token.js'

import { ENVIRONMENT } from './constant.js'

redis.addCommand('FT.CREATE')
redis.addCommand('FT.INFO')
redis.addCommand('FT.ADD')
redis.addCommand('FT.ADDHASH')
redis.addCommand('FT.SEARCH')
redis.addCommand('FT.DEL')

const { PORT, GRAPHQL_PATH, SERVER_HOST, ORIGINS, REDIS_URL } = ENVIRONMENT
const client = redis.createClient({
  url           : REDIS_URL,
  retry_strategy: ({ attempt }) => {
    /* c8 ignore next 6 */
    // no testing of redis reconnection
    console.warn(`Unable to reach redis instance, retrying.. [${ attempt }]`)
    if (attempt > 10)
      return new Error(`Can't connect to redis after ${ attempt } tries..`)
    return 250 * 2 ** attempt
  },
})

await new Promise(resolve => {
  client.on('ready', resolve)
})
await sync(client, readFileSync('./src/schema.gql', 'utf-8'), 10, true)

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
                client,
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
  client.quit()
})

export default http_server
