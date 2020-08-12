import { readFileSync } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

import Koa from 'koa'
import body_parser from 'koa-bodyparser'
import Router from 'koa-router'
import cors from '@koa/cors'
import { buildSchema, GraphQLError } from 'graphql/index.mjs'
import graphql_http from '@hydre/graphql-http/koa'
import Rgraph from '@hydre/rgraph'
import Parser from 'ua-parser-js'
import crypto from 'crypto'
import rootValue from './root.js'
import Token from './token.js'

import { ENVIRONMENT } from './constant.js'
import { master_client, slave_client } from './sentinel.js'

const { PORT, GRAPHQL_PATH, SERVER_HOST, ORIGINS, GRAPH_NAME } = ENVIRONMENT
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
          formatError : error => new GraphQLError(error.message),
          buildContext: async context => {
            const Graph = Rgraph(master_client)(GRAPH_NAME)

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
                  ip: ip?.split(',')?.[0],
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
              Graph,
              publish     : id => master_client.publish('__auth__', id),
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
          const base = `http://${ SERVER_HOST }:${ PORT }`

          console.log(`
    :: Authentication online 🔒 ${ base }${ GRAPHQL_PATH }
    :: Liveness probe online 💙 ${ base }/healthz
      `)
        },
    )

http_server.on('close', () => {
  master_client.quit()
  slave_client.quit()
})

export default http_server
