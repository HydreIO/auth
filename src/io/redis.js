import { RedisCache } from 'apollo-server-cache-redis'
const debug = 'redis' |> require('debug')('auth').extend

export const loadRedis = host =>
	new RedisCache({ host }) |> (_ => (debug('Connecting to redis cluster'), _))
