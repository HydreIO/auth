import rxjs from 'rxjs'
import operators from 'rxjs/operators'
import neo4j from 'neo4j-driver'
import Debug from 'debug'

const { map, concat, tap } = operators
const { interval } = rxjs
const debug = Debug('auth').extend('graph')

export default ({ uri, pwd = '', user = '', encryption }) => {
  let driver
  return {
    connect: async () => {
      debug(`Bolt connection [auth: %O] [encryption: %O]`, !!user, encryption)
      driver = neo4j.driver(uri, neo4j.auth.basic(user, pwd), { encrypted: encryption ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF' })
    },
    crud: {
      fetchByUid: async uuid => {
        const rxSession = driver.rxSession()
        return rxSession.run('MATCH (user:User {uuid: $uuid})-[:HAS_SESSION]->(session:Session) RETURN user, COLLECT(session) AS sessions', { uuid })
          .records()
          .pipe(
            map(records => {
              const userNode = records.get('user')
              if (!userNode) return undefined
              const sessionsNodeList = records.get('sessions')
              const { properties } = userNode
              const sessions = sessionsNodeList.map(({ properties }) => properties)
              return { ...properties, sessions }
            }),
            tap(debug),
            concat(rxSession.close())
          ).toPromise()

      },
      fetchByMail: async mail => {
        const rxSession = driver.rxSession()
        return rxSession.run('MATCH (user:User {mail: $mail})-[:HAS_SESSION]->(session:Session) RETURN user, COLLECT(session) AS sessions', { mail })
          .records()
          .pipe(
            map(records => {
              const userNode = records.get('user')
              if (!userNode) return undefined
              const sessionsNodeList = records.get('sessions')
              const { properties } = userNode
              const sessions = sessionsNodeList.map(({ properties }) => properties)
              return { ...properties, sessions }
            }),
            tap(debug),
            concat(rxSession.close())
          ).toPromise()
      },
      pushByUid: async (uuid, user) => {
        const { sessions, ...userWithoutSessions } = user
        const rxSession = driver.rxSession()
        return rxSession.run(
          `MERGE (user:User {uuid: $uuid})
           SET user += $user
           WITH user, $sessions as userSessions
           UNWIND userSessions AS userSession
           MERGE (user)-[:HAS_SESSION]->(mergedSession:Session { hash: userSession.hash })
           SET mergedSession += userSession
           WITH DISTINCT user, collect(userSession.hash) as newSessionHash
           MATCH (user)-->(s:Session)
           WHERE NOT s.hash IN newSessionHash
           DETACH DELETE s`, { user: userWithoutSessions, sessions, uuid })
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