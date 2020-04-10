import Debug from 'debug'
import rxjs from 'rxjs'
import operators from 'rxjs/operators'
import dgraph from 'dgraph-js'
import grpc from 'grpc'
import backoffs from 'backoff-rxjs'
import { inspect } from 'util'

const debug = Debug('auth').extend('dgraph')
const { of, from, defer } = rxjs
const { concatMapTo, tap } = operators
const { retryBackoff } = backoffs

export default ({ uri, maxRetries }) => {
  const clientStub = new dgraph.DgraphClientStub(uri, grpc.credentials.createInsecure())
  const client = new dgraph.DgraphClient(clientStub)
  return {
    async connect() {
      debug(`initializing.. [${uri}] [maxRetries: %d]`, maxRetries)
      let retried = 0
      await of(undefined).pipe(
        tap(() => debug('connecting to dgraph.. [%d]', ++retried)),
        concatMapTo(defer(async () => await client.newTxn().query('{ a() {} }'))),
        retryBackoff({ initialInterval: 500, maxRetries }),
      ).toPromise().catch(e => {
        console.error(e)
        debug.extend('error')('unable to reach dgraph instance after %d tries.. exit', maxRetries)
        process.exit(1)
      })
      debug('connected!')
      const op = new dgraph.Operation()
      op.setSchema(`
      type user {
        uuid
        mail
        hash
        verified
        verificationCode
        lastInvitationSent
        sessions
      }

      type session {
        ip
        browserName
        osName
        deviceModel
        deviceType
        deviceVendor
        refreshToken
        hash
      }

      uuid: string @index(exact) @upsert .
      mail: string @index(exact) @upsert .
      hash: string @index(exact) .
      verified: bool .
      verificationCode: string .
      lastInvitationSent: float .
      sessions: [uid] .
      ip: string .
      browserName: string .
      osName: string .
      deviceModel: string .
      deviceType: string .
      deviceVendor: string .
      refreshToken: string .
      `)
      await client.alter(op)
    },
    crud: {
      async fetchByUid($uuid) {
        const query = `
        query q($uuid: string!) {
          user(func: eq(uuid, $uuid)) {
            uuid
            mail
            hash
            verified
            sessions {
              ip
              browserName
              osName
              deviceModel
              deviceType
              deviceVendor
              refreshToken
              hash
            }
          }
        }`
        const result = await client.newTxn().queryWithVars(query, { $uuid })
        const { user } = result.getJson()
        return user[0]
      },
      async fetchByMail($mail) {
        const query = `
        query q($mail: string!) {
          user(func: eq(mail, $mail)) {
            uuid
            mail
            hash
            verified
            sessions {
              ip
              browserName
              osName
              deviceModel
              deviceType
              deviceVendor
              refreshToken
              hash
            }
          }
        }`
        const result = await client.newTxn().queryWithVars(query, { $mail })
        const { user } = result.getJson()
        return user[0]
      },
      async existByMail(mail) {
        const query = `{ user(func: eq(mail, "${mail}")) { count(uid) } }`
        const result = await client.newTxn().query(query)
        const { user } = result.getJson()
        return !!user[0].count
      },
      async pushByUid(uuid, user) {
        const { sessions, ...userWithoutSessions } = user

        const hashs = sessions.map(({ hash }) => hash)
        const hashs_to_strings = hashs.map(hash => `"${hash}"`)
        const outdated_session_query = `outdated_session as var(func: uid(session)) @filter(NOT eq(hash, [${(hashs_to_strings.length && hashs_to_strings || ['""']).join()}]))`
        const hashs_to_queries = hashs.map(hash => `h_${hash} as var(func: uid(session)) @filter(eq(hash, "${hash}"))`)

        const query = `
        query q($uuid: string!) {
          user as var(func: eq(uuid, $uuid)) {
            session as sessions
          }
          ${[outdated_session_query, ...hashs_to_queries].join('\n')}
        }`
        const upsert_user = new dgraph.Mutation()
        upsert_user.setSetJson({
          uid: "uid(user)",
          ['dgraph.type']: 'user',
          ...userWithoutSessions,
          sessions: sessions.map(session => ({
            ['dgraph.type']: 'session',
            uid: `uid(h_${session.hash})`,
            ...session
          }))
        })
        const delete_outdated_sessions = new dgraph.Mutation()
        delete_outdated_sessions.setCond('@if(gt(len(outdated_session), 0))')
        delete_outdated_sessions.setDelNquads(`
          uid(user) <sessions> uid(outdated_session) .
          uid(outdated_session) * * .
          `)
        const req = new dgraph.Request()
        req.setQuery(query)
        req.getVarsMap().set('$uuid', uuid)
        req.setMutationsList([upsert_user, delete_outdated_sessions])
        req.setCommitNow(true)
        await client.newTxn().doRequest(req)
      }
    }
  }
}
