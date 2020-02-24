import rgraph from '@hydre/rgraph'
import { plusEquals } from '@hydre/rgraph/src/operators'
import redis from 'redis'
import { inspect, promisify } from 'util'
import rxjs from 'rxjs'
import operators from 'rxjs/operators'
import Debug from 'debug'

const { interval } = rxjs
const { map } = operators
const debug = Debug('auth').extend('graph')
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
        await run`MERGE (user:User {uuid: ${uuid}})
                  WITH user
                  SET ${plusEquals('user', userWithoutSessions)}
                  WITH ${sessions} as userSessions
                  UNWIND userSessions AS userSession
                  MERGE (user)-[:HAS_SESSION]->(mergedSession:Session { hash: userSession.hash })
                  SET mergedSession += userSession
                  WITH DISTINCT user, collect(newSession.hash) as newSessionHash
                  MATCH (user)-->(s:Session)
                  WHERE NOT s.hash IN newSessionHash
                  DELETE s`.toPromise()
      },
      existByMail: async mail => run`MATCH (user:User {mail: ${mail}}) RETURN user`.pipe(map(result => !!result?.user)).toPromise()
    }
  }
}