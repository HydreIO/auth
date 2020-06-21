import Doubt from '@hydre/doubt'
import reporter from 'tap-spec-emoji'
import { pipeline, PassThrough } from 'stream'
import { readFileSync } from 'fs'
import GR from 'graphql-request'
import redis from 'redis'
import util from 'util'
import sync from '@hydre/disk/src/synchronize.js'
import fetch from 'node-fetch'
import compose from 'docker-compose'
import zmq from 'zeromq'

globalThis.fetch = fetch

const through = new PassThrough()
const mail_socket = new zmq.Pull

mail_socket.connect('tcp://0.0.0.0:3001')

pipeline(through, reporter(), process.stdout, () => {})

redis.addCommand('FT.CREATE')
redis.addCommand('FT.INFO')
redis.addCommand('FT.ADD')
redis.addCommand('FT.ADDHASH')
redis.addCommand('FT.SEARCH')
redis.addCommand('FT.DEL')

const doubt = Doubt({
  stdout: through,
  title  : 'Authentication',
  calls  : 29,
})
const host = 'http://localhost:3000'
const cwd = process.cwd()
const reach_auth = async () => {
  try {
    await fetch(`${ host }/healthz`)
    console.log('/healthz >> Auth ready!')
  } catch {
    await new Promise(resolve => setTimeout(resolve, 500))
    await reach_auth()
  }
}


try {
  await compose.upAll({
    cwd,
    log           : true,
    commandOptions: ['--build'],
  })

  const client = redis.createClient()
  const send = util.promisify(client.send_command.bind(client))

  // await redis
  await new Promise(resolve => {
    client.on('ready', resolve)
  })

  await sync(client, readFileSync('./src/schema.gql', 'utf-8'), 10, true)
  // await auth
  await reach_auth()

  const create_account = await GR.request(host, /* GraphQL */`
    mutation {
      create_user(mail: "foo@bar.com", pwd: "foobar1")
    }
  `)

  doubt['An account can be created']({
    because: create_account,
    is     : { create_user: true },
  })

  const create_session = await GR.request(host, /* GraphQL */`
    mutation {
      create_session(mail: "foo@bar.com", pwd: "foobar1", remember: true)
    }
  `)

  doubt['A session can be created']({
    because: create_session,
    is     : { create_user: true },
  })

  await new Promise(resolve => {
    client.quit(resolve)
  })
} finally {
  await compose.down({
    cwd,
    log: true,
  })
}

