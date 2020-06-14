import Koa from 'koa'
import Debug from 'debug'
import { readFileSync } from 'fs'
import body_parser from 'koa-bodyparser'
import cors from '@koa/cors'
import graphql from 'graphql'
import graphql_http from '@hydre/graphql-http/koa'
import Parser from 'ua-parser-js'
import crypto from 'crypto'
import { PORT } from './environment.js'

const debug = Debug('auth').extend('koa')
const extract_session = context => {
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
}

new Koa()
    .use(cors({
      origin      : '',
      allowMethods: ['POST', 'GET'],
      credentials : true,
    }))
    .use(body_parser)
    .use(graphql_http({
      buildContext: async context => {
        return {
          session: extract_session(context),
        }
      },
    }))
    .listen(PORT)
