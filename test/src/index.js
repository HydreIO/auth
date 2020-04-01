import graphql_request from 'graphql-request'
import '@hydre/doubt'
import rxjs from 'rxjs'
import operators from 'rxjs/operators'
import backoffs from 'backoff-rxjs'
import debug from 'debug'
import fetch from 'node-fetch'
import fetch_cookie from 'fetch-cookie/node-fetch'

// initializing fetch-cookie
fetch_cookie(fetch)

const log = debug('test')

const { defer, of, from } = rxjs
const { concatMap, tap } = operators
const { retryBackoff } = backoffs
const { GraphQLClient } = graphql_request

const { ENDPOINT } = process.env
const client = new GraphQLClient(ENDPOINT, { credentials: 'include', mode: 'cors' })

const readiness_check = async () => { log('awaiting readiness..'); await client.request(/* GraphQL */ `{ ping }`) }
const query_certificate = async () => client.request(/* GraphQL */ `{ cert }`)
const query_whoami = async () => client.request(/* GraphQL */ `{ me { uuid } }`)

const test_process = async package_name => {
  // making sur the authentication is ready to be tested
  log('testing %s', package_name)
  await defer(readiness_check).pipe(retryBackoff({ initialInterval: 500, maxRetries: 10 })).toPromise()
  package_name.doubt(async () => {
    await 'provide a valid certificat'.because(query_certificate).succeeds()
    await 'fails to retrieve user when we are not authenticated'.because(query_whoami).fails()
  })
}

of('auth-server-dgraph', 'auth-server-mongo').pipe(concatMap(name => from(test_process(name)))).subscribe({
  next: () => { log('done.') },
  complete: () => { log('all tests have been processed') },
  error: e => console.error(e)
})
