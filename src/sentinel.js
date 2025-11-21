import Redis from 'ioredis'
import events from 'events'
import { ENVIRONMENT } from './constant.js'

const { REDIS_HOST, REDIS_SENTINEL_PORT, REDIS_MASTER_NAME } = ENVIRONMENT
const connection_state = {
  online: false,
}

/* c8 ignore next 10 */
// not testing the retry strategy
const retryStrategy = (label) => (attempt) => {
  console.warn(`[${label}] Unable to reach redis, retrying.. [${attempt}]`)
  if (attempt > 5) {
    connection_state.online = false
    return new Error(`Can't connect to redis after ${attempt} tries..`)
  }

  return 250 * 2 ** attempt
}

// Use direct connection for development/test, sentinel for production
const USE_SENTINEL = process.env.REDIS_USE_SENTINEL === 'true'
let master_client, slave_client

if (USE_SENTINEL) {
  const sentinel_options = (role) => ({
    sentinels: [
      {
        host: REDIS_HOST,
        port: REDIS_SENTINEL_PORT,
      },
    ],
    name: REDIS_MASTER_NAME,
    role,
    sentinelRetryStrategy: retryStrategy(role),
  })
  master_client = new Redis(sentinel_options('master'))
  slave_client = new Redis(sentinel_options('slave'))
} else {
  // Direct connection for dev/test
  const direct_options = {
    host: REDIS_HOST,
    port: 6379,
    retryStrategy: retryStrategy('redis'),
  }
  master_client = new Redis(direct_options)
  slave_client = master_client // Use same client for both in dev mode
}

await Promise.all([
  events.once(slave_client, 'ready'),
  events.once(master_client, 'ready'),
])

new Set([master_client, slave_client]).forEach((client) => {
  client.on('error', () => {})
})
connection_state.online = true

export { master_client, slave_client, connection_state }
