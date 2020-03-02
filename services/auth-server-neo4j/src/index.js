import boltConnector from '@hydre/datas-neo4j'
import authServer from '@hydre/auth-core'

const {
  BOLT_URI = 'bolt://localhost:7687',
  BOLT_USER = '',
  BOLT_PWD = '',
  BOLT_ENCRYPTION = false,
  RETRIES = 10
} = process.env

void async function() {
  const { connect, crud } = boltConnector({ maxRetries: RETRIES, uri: BOLT_URI, pwd: BOLT_PWD, user: BOLT_USER, encryption: `${BOLT_ENCRYPTION}`.toLowerCase() === 'true' })
  await connect()
  await authServer(crud)
}()