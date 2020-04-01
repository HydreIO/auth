import Debug from 'debug'
import rxjs from 'rxjs'
import operators from 'rxjs/operators'
import dgraph from 'dgraph-js'
import grpc from 'grpc'
import backoffs from 'backoff-rxjs'

const debug = Debug('auth').extend('dgraph')
const { of, from, defer } = rxjs
const { concatMapTo, tap } = operators
const { retryBackoff } = backoffs

const schema = `
  type user {
    user.uuid
    user.mail
    user.hash
    user.verified
    user.verificationCode
    user.lastInvitationSent
    user.sessions
  }

  type session {
    session.ip
    session.browserName
    session.osName
    session.deviceModel
    session.deviceType
    session.deviceVendor
    session.refreshToken
  }

  user.uuid: string @index(exact) @upsert .
  user.mail: string @index(exact) @upsert .
  user.hash: string .
  user.verified: bool .
  user.verificationCode: string .
  user.lastInvitationSent: float .
  user.sessions: [uid] .

  session.ip: string .
  session.browserName: string .
  session.osName: string .
  session.deviceModel: string .
  session.deviceType: string .
  session.deviceVendor: string .
  session.refreshToken: string .
`

/**
 * Dgraph use a global schema, we thus has to namespace our value using `foo.bar` instead of just `bar` inside the type `foo`
 * we here remove the namespace in case there is one, if not we just return the key (useful for Dgraph uid or non namespaced properties)
 * @param {Object} object the result
 */
const removeNamespace = (object = {}) => {
  const mapper = ([k, v]) => {
    const key = k.split('.')[1]
    return [key ?? k, v]
  }
  return Object.fromEntries(Object.entries(object).map(mapper))
}

const addNamespace = (object = {}, namespace) => Object.fromEntries(Object.entries(object).map(([k, v]) => [`${namespace}.${k}`, v]))

export default ({ uri, maxRetries }) => {
  const clientStub = new dgraph.DgraphClientStub(uri, grpc.credentials.createInsecure())
  const client = new dgraph.DgraphClient(clientStub)
  client.setDebugMode(true)
  return {
    async connect() {
      debug('initializing.. [maxRetries: %d]', maxRetries)
      let retried = 0
      await of(undefined).pipe(
        tap(() => debug('connecting to dgraph.. [%d]', ++retried)),
        concatMapTo(defer(async () => await client.newTxn().query('{ a() {} }'))),
        concatMapTo(defer(async () => {
          const op = new dgraph.Operation()
          op.setDropAll(true)
          await client.alter(op)
        })),
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
          user(func: eq(user.uuid, "${uuid}")) {
            user.uuid
            user.mail
            user.verified
            user.sessions {
              session.ip
              session.browserName
              session.osName
              session.deviceModel
              session.deviceType
              session.deviceVendor
              session.refreshToken
            }
          }
        }`
        const result = await client.newTxn().query(query)
        const { user } = result.getJson()
        return removeNamespace(user[0])
      },
      async fetchByMail(mail) {
        const query = `{
          user(func: eq(user.mail, "${mail}")) {
            user.uuid
            user.mail
            user.verified
            user.sessions {
              session.ip
              session.browserName
              session.osName
              session.deviceModel
              session.deviceType
              session.deviceVendor
              session.refreshToken
            }
          }
        }`
        const result = await client.newTxn().query(query)
        const { user } = result.getJson()
        return removeNamespace(user[0])
      },
      async existByMail(mail) {
        const query = `{ user(func: eq(user.mail, "${mail}")) {} }`
        const result = await client.newTxn().query(query)
        const { user } = result.getJson()
        debug(user)
        return !!user.length
      },
      async pushByUid(uuid, user) {
        const query = `{ user as var(func: eq(user.uuid, "${uuid}")) {} }`
        const mutation = new dgraph.Mutation()
        const { sessions, ...userWithoutSessions } = user
        mutation.setSetJson({
          uid: "uid(user)",
          ['dgraph.type']: 'user',
          ...addNamespace(userWithoutSessions, 'user'),
          ['user.sessions']: sessions.map(session => ({ ['dgraph.type']: 'session', ...addNamespace(session, 'session') }))
        })
        const req = new dgraph.Request()
        req.setQuery(query)
        req.setMutationsList([mutation])
        req.setCommitNow(true)
        await client.newTxn().doRequest(req)
      }
    }
  }
}
