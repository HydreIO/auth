import rxjs from 'rxjs'
import operators from 'rxjs/operators'
import neo4j from 'neo4j-driver'
import Debug from 'debug'
import backoffs from 'backoff-rxjs'

const { map, concat, tap, retryWhen, concatMapTo, concatMap, take, delay, debounce } = operators
const { interval, from, of, throwError, Subject } = rxjs
const { retryBackoff } = backoffs
const debug = Debug('auth').extend('graph')

export default ({ uri, pwd = '', user = '', encryption, maxRetries }) => {
  let driver
  let retried = 0
  let session

  const getSession = () => {
    if (!session) session = driver.rxSession()
    else if (!session._session._open) session = driver.rxSession()
    return session
  }


  return {
    connect: async () => {
      debug(`Bolt connection [auth: %O] [encryption: %O] [maxRetries: %d]`, !!user, encryption, maxRetries)
      driver = neo4j.driver(uri, neo4j.auth.basic(user, pwd), { encrypted: encryption ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF' })
      await of(undefined).pipe(
        tap(() => { debug('connecting to bolt uri.. [%d]', ++retried) }),
        concatMapTo(from(driver.verifyConnectivity())),
        retryBackoff({ initialInterval: 500, maxRetries })
      ).toPromise().catch(e => {
        console.error(e)
        debug.extend('error')('unable to reach bolt instance after %d tries.. exit', maxRetries)
        process.exit(1)
      })
      debug('connected!')
    },
    crud: {
      fetchByUid: async uuid => {
        const rxSession = getSession()
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
          ).toPromise()

      },
      fetchByMail: async mail => {
        const rxSession = getSession()
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
          ).toPromise()
      },
      pushByUid: async (uuid, user) => {
        const { sessions, ...userWithoutSessions } = user
        const rxSession = getSession()
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
          .records().toPromise()
      },
      existByMail: async mail => {
        const rxSession = driver.rxSession()
        return rxSession.run('MATCH (user:User {mail: $mail}) RETURN user', { mail })
          .records()
          .pipe(map(records => !!records.get('user'))).toPromise()
      }
    }
  }
}