import { RedisCache } from 'apollo-server-cache-redis'
const debug = 'redis' |> require('debug')('auth').extend

export const loadRedis = host => port => password =>
	new RedisCache({ host, port, password }) |> (_ => (debug('Connecting to redis cluster'), _))
