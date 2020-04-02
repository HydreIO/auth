import graphql_request from 'graphql-request'
import doubt from '@hydre/doubt'
import rxjs from 'rxjs'
import operators from 'rxjs/operators'
import backoffs from 'backoff-rxjs'
import debug from 'debug'
import fetch from 'node-fetch'
import fetch_cookie from 'fetch-cookie/node-fetch'
import compose from 'docker-compose'
import tap_spec from 'tap-spec'

// initializing fetch-cookie
fetch_cookie(fetch)
doubt.createStream().pipe(tap_spec()).pipe(process.stdout)

const log = debug('test')
const { defer, of, from } = rxjs
const { concatMap, tap } = operators
const { retryBackoff } = backoffs
const { GraphQLClient } = graphql_request

export default async ({ compose_file, endpoint }) => {
  const client = new GraphQLClient(endpoint, { credentials: 'include', mode: 'cors' })
  const readiness_check = async () => { log('awaiting readiness..'); await client.request(/* GraphQL */ `{ ping }`) }
  const query_certificate = async () => client.request(/* GraphQL */ `{ cert }`)
  const query_whoami = async () => client.request(/* GraphQL */ `{ me { uuid } }`)

  log('composing..')
  await compose.upAll({ cwd: compose_file, log: true, commandOptions: ['--build'] })
  // making sur the authentication is ready to be tested
  await defer(readiness_check).pipe(retryBackoff({ initialInterval: 500, maxRetries: 10 })).toPromise()
  log('running tests..')
  'Reach'.doubt(async () => {
    await 'provide a valid certificate'.because(query_certificate).succeeds()
    await 'fails to retrieve user when we are not authenticated'.because(query_whoami).fails()
  })
  doubt.onEnd(async () => {
    log('shutting down containers..')
    await compose.down({ cwd: compose_file, log: true })
  })
}