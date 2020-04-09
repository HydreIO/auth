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

const schema = `
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
  hash: string .
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
`

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
        concatMapTo(defer(async () => {
          const op = new dgraph.Operation()
          op.setSchema(schema)
          await client.alter(op)
        })),
        retryBackoff({ initialInterval: 500, maxRetries }),
      ).toPromise().catch(e => {
        console.error(e)
        debug.extend('error')('unable to reach dgraph instance after %d tries.. exit', maxRetries)
        process.exit(1)
      })
      debug('connected!')
    },
    crud: {
      async fetchByUid(uuid) {
        const query = `{
          user(func: eq(uuid, "${uuid}")) {
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
        const result = await client.newTxn().query(query)
        const { user } = result.getJson()
        debug('found %O', user[0].sessions)
        return user[0]
      },
      async fetchByMail(mail) {
        const query = `{
          user(func: eq(mail, "${mail}")) {
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
        const result = await client.newTxn().query(query)
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
        const hashs = sessions.map(({ hash }) => `"${hash}"`)
        const query = `
        {
          user as var(func: eq(uuid, "${uuid}")) {
            user_sessions as sessions
          }

          outdated_session as var(func: uid(user_sessions)) @filter(NOT eq(hash, [${hashs.join()}])) {}
        }`
        const mutation = new dgraph.Mutation()
        mutation.setSetJson({
          uid: "uid(user)",
          ['dgraph.type']: 'user',
          ...userWithoutSessions,
          sessions: sessions.map(session => ({ ['dgraph.type']: 'session', ...session }))
        })
        mutation.setDeleteJson({ uid: "uid(outdated_session)" })
        const req = new dgraph.Request()
        req.setQuery(query)
        req.setMutationsList([mutation])
        req.setCommitNow(true)
        await client.newTxn().doRequest(req)
      }
    }
  }
}
