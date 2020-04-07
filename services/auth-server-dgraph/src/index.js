import gRpcConnector from '@hydre/datas-dgraph'
import authServer from '@hydre/auth-core'

const {
  DGRAPH_RPC_URI = 'localhost:9080',
  RETRIES = 10
} = process.env

void async function() {
  const { connect, crud } = gRpcConnector({ maxRetries: RETRIES, uri: DGRAPH_RPC_URI })
  await connect()
  await authServer(crud)
}()