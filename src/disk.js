import { ENVIRONMENT } from './constant.js'
import { promisify } from 'util'
import { v4 as uuid4 } from 'uuid'
import redis from 'redis'

const { REDIS_URL } = ENVIRONMENT
const client = redis.createClient({
  url           : REDIS_URL,
  retry_strategy: ({ attempt, error }) => {
    console.error('[redis]', error)
    if (attempt > 10)
      return new Error(`Can't connect to redis after ${ attempt } tries..`)
    return 250 * 2 ** attempt
  },
})
const call = promisify(client.send_command).bind(client)
const transient_types = new Set(['symbol', 'function', 'undefined', 'null'])
const serialize_fields = fields => Object
    .entries(fields)
    .filter(([, value]) => !transient_types.has(typeof value))
    .map(([key, value]) => {
      switch (typeof value) {
        case 'number':
          return `${ key } ${ value }`

        case 'bigint':
          return `${ key } ${ value.toString() }`

        case 'object':
          return `${ key } "${ JSON.stringify(value) }"`

        default:
          return `${ key } "${ value }"`
      }
    })
    .join(' ')

await new Promise(resolve => {
  client.on('ready', resolve)
})

console.dir(await call('FT.SEARCH', ['users', '"sceat"']), {
  depth : Infinity,
  colors: true,
})


