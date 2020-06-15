import { readFileSync } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

import Koa from 'koa'
import body_parser from 'koa-bodyparser'
import Router from 'koa-router'
import cors from '@koa/cors'

import { buildSchema } from 'graphql/index.mjs'
import graphql_http from '@hydre/graphql-http/koa'

import Parser from 'ua-parser-js'
import crypto from 'crypto'

import { ENVIRONMENT } from './constant.js'

const { PORT, GRAPHQL_PATH, SERVER_HOST, SERVER_PATH, ORIGINS } = ENVIRONMENT
const directory = dirname(fileURLToPath(import.meta.url))
const schema = readFileSync(`${ directory }/schema.gql`, 'utf8')
const router = new Router()
    .get('/healthz', context => {
      context.body = 'ok'
    })
    .use(
        GRAPHQL_PATH,
        graphql_http({
          schema      : buildSchema(schema),
          buildContext: async context => {
            return {
              build_session: () => {
                const { headers } = context.req
                const { 'user-agent': user_agent, 'x-forwarded-for': ip } = headers
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
    .use(body_parser)
    .use(router)
    .listen(
        {
          port: +PORT,
          host: SERVER_HOST,
          path: SERVER_PATH,
        },
        () => {
          const base = `https://${ SERVER_HOST }:${ PORT }`

          console.log(`
    :: Authentication online 🔒 ${ base }${ GRAPHQL_PATH }
    :: Liveness probe online 💙 ${ base }/healthz
      `)
        },
    )
