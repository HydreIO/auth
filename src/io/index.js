/**
 * I/O abstraction layer
 * Conditionally exports Redis or local mock based on DISABLE_IO env var
 */

const USE_LOCAL_IO = process.env.DISABLE_IO === 'true'

const { master_client, slave_client, connection_state } = USE_LOCAL_IO
  ? await import('./local.js')
  : await import('./redis.js')

export { master_client, slave_client, connection_state }
