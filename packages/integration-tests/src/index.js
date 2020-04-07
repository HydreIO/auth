import doubt from '@hydre/doubt'
import rxjs from 'rxjs'
import operators from 'rxjs/operators'
import backoffs from 'backoff-rxjs'
import debug from 'debug'
import compose from 'docker-compose'
import tap_spec from 'tap-spec-emoji'
import zmq from 'zeromq'

doubt.createStream().pipe(tap_spec()).pipe(process.stdout)

const log = debug('auth').extend('test')
const log_docker = log.extend('docker')
const log_tcp = log.extend('tcp')

const { defer, of } = rxjs
const { concatMap, concatMapTo, tap } = operators
const { retryBackoff } = backoffs

const health_address = 'tcp://0.0.0.0:3002'
const socket_client = new zmq.Stream({ immediate: true, receiveTimeout: 300 })

const authentication_up_and_running = async () => {
  await of(socket_client.connect(health_address))
    .pipe(
      tap(() => { log_tcp('connecting..') }),
      concatMapTo(defer(async () => await socket_client.receive())),
      tap(() => log_tcp('health check succeeded')),
      tap(() => { socket_client.disconnect(health_address) }),
      retryBackoff({ initialInterval: 500, maxRetries: 10 })
    ).toPromise()
}

export default async ({ compose_file, endpoint }) => {

  log_docker('setting up containers..')
  await compose.upAll({ cwd: compose_file, log: false, commandOptions: ['--build'] })

  log_tcp('awaiting readiness..%O', health_address)
  // making sur the authentication is ready to be tested
  await authentication_up_and_running()

  log('running tests..')
  process.env.ENDPOINT = endpoint
  import('./tests')

  log('cleaning up..')
  doubt.onEnd(async () => {
    log.extend('docker')('shutting down containers..')
    await compose.down({ cwd: compose_file, log: true })
  })
}