import { interval } from 'rxjs'
import { concatMapTo, map } from 'rxjs/operators'
import neo4j from 'neo4j-driver'

const debug = require('debug')('auth').extend('graph')

export default ({ uri, graph }) => {
  let driver
  return {
    connect: async () => { driver = neo4j.driver(uri) },
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