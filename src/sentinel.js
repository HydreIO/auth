import Redis from 'ioredis'
import events from 'events'
import { ENVIRONMENT } from './constant.js'

const {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_SENTINEL_PORT,
  REDIS_MASTER_NAME,
} = ENVIRONMENT
/* c8 ignore next 7 */
// not testing the retry strateg
const retryStrategy = label => attempt => {
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
const master_client = new Redis({
  sentinels: [
    {
      host: REDIS_HOST,
      port: REDIS_SENTINEL_PORT,
    },
  ],
  name                 : REDIS_MASTER_NAME,
  sentinelRetryStrategy: retryStrategy('sentinel'),
})

await Promise.all([
  events.once(slave_client, 'ready'),
  events.once(master_client, 'ready'),
])

new Set([master_client, slave_client]).forEach(client => {
  client.on('error', () => {})
})

export { master_client, slave_client }
