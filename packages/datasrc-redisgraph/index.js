import rgraph from '@hydre/rgraph'
import { plusEquals } from '@hydre/rgraph/operators'
import redis from 'redis'
import { inspect, promisify } from 'util'
import { interval } from 'rxjs'
import { concatMapTo, map } from 'rxjs/operators'

const debug = require('debug')('auth').extend('graph')
const extractUser = result => result?.user

export default ({ uri, graph }) => {
  let run
  return {
    connect: async () => {
      run = rgraph(redis.createClient(uri))(graph).run
    },
    crud: {
      fetchByUid: async uuid => run`MATCH (user:User {uuid: ${uuid}}) RETURN user`.pipe(map(extractUser)).toPromise(),
      fetchByMail: async mail => run`MATCH (user:User {mail: ${mail}}) RETURN user`.pipe(map(extractUser)).toPromise(),
      pushByUid: async (uuid, user) => {
        const { sessions, ...userWithoutSessions } = user
        await run`MERGE (user:User {uuid: ${uuid}}) SET ${plusEquals('user', userWithoutSessions)}`.toPromise()
      },
      existByMail: async mail => run`MATCH (user:User {mail: ${mail}}) RETURN user`.pipe(map(result => !!result?.user)).toPromise()
    }
  }
}