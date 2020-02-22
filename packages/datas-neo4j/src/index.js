import { interval } from 'rxjs'
import { map, concat } from 'rxjs/operators'
import neo4j from 'neo4j-driver'

const debug = require('debug')('auth').extend('graph')

export default ({ uri, graph }) => {
  let driver
  return {
    connect: async () => { driver = neo4j.driver(uri) },
    crud: {
      fetchByUid: async uuid => {
        const rxSession = driver.rxSession()
        return rxSession.run('MATCH (user:User {uuid: $uuid}) RETURN user', { uuid })
          .records()
          .pipe(
            map(records => records.get('user')),
            concat(rxSession.close())
          ).toPromise()

      },
      fetchByMail: async mail => {
        const rxSession = driver.rxSession()
        return rxSession.run('MATCH (user:User {mail: $mail}) RETURN user', { mail })
          .records()
          .pipe(
            map(records => records.get('user')),
            concat(rxSession.close())
          ).toPromise()
      },
      pushByUid: async (uuid, user) => {
        const { sessions, ...userWithoutSessions } = user
        const rxSession = driver.rxSession()
        return rxSession.run(
          `MERGE (user:User {uuid: ${uuid}})
           WITH user
           SET user += $user
           WITH $sessions as userSessions
           UNWIND userSessions AS userSession
           MERGE (user)-[:HAS_SESSION]->(mergedSession:Session { hash: userSession.hash })
           SET mergedSession += userSession
           WITH DISTINCT user, collect(newSession.hash) as newSessionHash
           MATCH (user)-->(s:Session)
           WHERE NOT s.hash IN newSessionHash
           DETACH DELETE s`, { user: userWithoutSessions, sessions })
          .records().pipe(concat(rxSession.close())).toPromise()
      },
      existByMail: async mail => {
        const rxSession = driver.rxSession()
        return rxSession.run('MATCH (user:User {mail: $mail}) RETURN user', { mail })
          .records()
          .pipe(
            map(records => !!records.get('user')),
            concat(rxSession.close())
          ).toPromise()
      }
    }
  }
}