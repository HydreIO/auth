import zmq from 'zeromq'
import { ENVIRONMENT, ERRORS } from './constant.js'
import { GraphQLError } from 'graphql'

const { SOCKET_NOTIFIER_ADDRESS, ENABLE_EMAIL } = ENVIRONMENT

// Lazy initialization - only create socket if email is enabled
let sock = null
let initialized = false

const initialize = async () => {
  if (initialized) return
  initialized = true

  if (!ENABLE_EMAIL) {
    console.warn('⚠️  Email disabled (ENABLE_EMAIL=false). Mail notifications will not be sent.')
    return
  }

  try {
    sock = new zmq.Push({ sendTimeout: 300 })
    await sock.bind(SOCKET_NOTIFIER_ADDRESS)
    console.log(`✓ Mail service initialized at ${SOCKET_NOTIFIER_ADDRESS}`)
  } catch (error) {
    console.error('[socket] Failed to initialize mail service:', error)
    throw new GraphQLError(ERRORS.MAIL_SERVICE_OFFLINE)
  }
}

const send = async (payload) => {
  // Initialize on first send attempt
  if (!initialized) {
    await initialize()
  }

  // No-op if email is disabled
  if (!ENABLE_EMAIL) {
    return
  }

  try {
    await sock.send(payload)
  } catch (error) {
    /* c8 ignore next 4 */
    // this is not relevant as it depends of unknown third party
    console.error('[socket]', error)
    throw new GraphQLError(ERRORS.MAIL_SERVICE_OFFLINE)
  }
}

export default {
  ACCOUNT_CREATE: 'ACCOUNT_CREATE',
  ACCOUNT_CONFIRM: 'ACCOUNT_CONFIRM',
  PASSWORD_RESET: 'PASSWORD_RESET',
  NEW_SESSION: 'NEW_SESSION',
  send,
  initialize, // Export for testing
}
