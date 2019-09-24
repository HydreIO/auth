import { RedisCache } from 'apollo-server-cache-redis'
const debug = 'redis' |> require('debug')('auth').extend

export const loadRedis = host => password =>
	new RedisCache({ host, password }) |> (_ => (debug('Connecting to redis cluster'), _))
