import redisGraphConnector from '@hydre/datas-redisgraph'
import authServer from '@hydre/auth-core'

const { REDIS_URI = 'redis://localhost:6379', GRAPH_NAME = 'auth' } = process.env

void async function() {
  const { connect, crud } = redisGraphConnector({ uri: REDIS_URI, graph: GRAPH_NAME })
  await connect()
  await authServer(crud)
}()