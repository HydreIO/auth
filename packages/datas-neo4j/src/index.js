import rxjs from 'rxjs'
import operators from 'rxjs/operators'
import neo4j from 'neo4j-driver'
import Debug from 'debug'
import backoffs from 'backoff-rxjs'

const { interval, concat, from, defer, of, throwError, Subject, empty, ReplaySubject } = rxjs
const { map, tap, concatMapTo, retry, concatMap, take, delay, debounceTime, flatMap, bufferTime, startWith } = operators
const { retryBackoff } = backoffs
const debug = Debug('auth').extend('graph')

export default ({ uri, pwd = '', user = '', encryption, maxRetries }) => {
  let driver

  const runner = () => {
    const closeSession = session => new ReplaySubject().pipe(
      concatMap(([query, args, res, rej]) => from(session.run(query, args).then(res).catch(rej))),
      debounceTime(500),
      concatMapTo(defer(session.close))
    )
    let runQuery$
    const defaultState = () => {
      runQuery$ = closeSession(driver.session())
      runQuery$.subscribe(() => { runQuery$ = undefined })
      return runQuery$
    }
    return async (query, args) => {
      if (!runQuery$) runQuery$ = defaultState()
      return new Promise((res, rej) => {
        runQuery$.next([query, args, res, rej])
      })
    }
  }

  const run = runner()

  return {
    async connect() {
      debug(`Bolt connection [auth: %O] [encryption: %O] [maxRetries: %O]`, !!user, encryption, maxRetries)
      let retried = 0
      await of(undefined).pipe(
        tap(() => {
          driver = neo4j.driver(uri, neo4j.auth.basic(user, pwd), { encrypted: encryption ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF' })
          debug('connecting to bolt uri.. [%d]', ++retried)
        }),
        concatMapTo(defer(async () => driver.verifyConnectivity())),
        retryBackoff({ initialInterval: 500, maxRetries })
      ).toPromise().catch(e => {
        console.error(e)
        debug.extend('error')('unable to reach bolt instance after %d tries.. exit', maxRetries)
        process.exit(1)
      })
      debug('connected!')
    },
    crud: {
      async fetchByUid(uuid) {
        const { records } = await run('MATCH (user:User {uuid: $uuid})-[:HAS_SESSION]->(session:Session) RETURN DISTINCT user, COLLECT(session) AS sessions', { uuid })
        const userNode = records[0].get('user')
        if (!userNode) return undefined
        const sessionsNodeList = records[0].get('sessions')
        const { properties } = userNode
        const sessions = sessionsNodeList.map(({ properties }) => properties)
        return { ...properties, sessions }
      },
      async fetchByMail(mail) {
        const { records } = await run('MATCH (user:User {mail: $mail})-[:HAS_SESSION]->(session:Session) RETURN DISTINCT user, COLLECT(session) AS sessions', { mail })
        const userNode = records[0].get('user')
        if (!userNode) return undefined
        const sessionsNodeList = records[0].get('sessions')
        const { properties } = userNode
        const sessions = sessionsNodeList.map(({ properties }) => properties)
        return { ...properties, sessions }
      },
      async pushByUid(uuid, user) {
        const { sessions, ...userWithoutSessions } = user
        await run(
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
      },
      async existByMail(mail) {
        const { records } = await run('MATCH (user:User {mail: $mail}) RETURN user', { mail })
        return !!records[0].get('user')
      }
    }
  }
}
