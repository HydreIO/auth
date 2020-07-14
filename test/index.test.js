/* eslint-disable max-lines */
import Doubt from '@hydre/doubt'
import reporter from 'tap-spec-emoji'
import { pipeline, PassThrough } from 'stream'
import GR from 'graphql-request'
import Redis from 'ioredis'
import compose from 'docker-compose'
import zmq from 'zeromq'
import fetch from 'node-fetch'
import fetch_cookie from 'fetch-cookie/node-fetch.js'
import tough from 'tough-cookie'
import { ENVIRONMENT } from '../src/constant.js'
import Rgraph from '@hydre/rgraph'

globalThis.fetch = fetch_cookie(
    fetch,
    new tough.CookieJar(new tough.MemoryCookieStore(), {
      rejectPublicSuffixes : false,
      allowSpecialUseDomain: true,
    }),
)

const through = new PassThrough()
const mail_socket = new zmq.Pull()

mail_socket.connect('tcp://0.0.0.0:3001')

pipeline(through, reporter(), process.stdout, () => {})

const doubt = Doubt({
  stdout: through,
  title : 'Authentication',
  calls : 46,
})
const host = 'http://localhost:3000'
const gql = new GR.GraphQLClient(host, {
  headers: {
    'user-agent':
      'Opera/9.30 (Nintendo Wii; U; ; 2071; Wii Shop Channel/1.0; en)',
  },
  credentials: 'include',
  mode       : 'cors',
})
const gql_no_agent = new GR.GraphQLClient(host, {
  credentials: 'include',
  mode       : 'cors',
})
const cwd = process.cwd()
const reach_auth = async () => {
  try {
    await fetch(`${ host }/healthz`)
  } catch {
    await new Promise(resolve => setTimeout(resolve, 500))
    await reach_auth()
  }
}
const request = async (...parameters) => {
  try {
    const result = await gql.request(...parameters)

    return { data: result }
  } catch (error) {
    return { errors: error.response.errors.map(({ message }) => message) }
  }
}
const request_no_ua = async (...parameters) => {
  try {
    const result = await gql_no_agent.request(...parameters)

    return { data: result }
  } catch (error) {
    return { errors: error.response.errors.map(({ message }) => message) }
  }
}

try {
  await compose.upAll({
    cwd,
    log           : true,
    commandOptions: ['--build'],
  })

  const client = new Redis()
  const { run } = Rgraph(client)('default')

  // await redis
  await new Promise(resolve => {
    client.once('ready', resolve)
  })

  const { default: auth_server } = await import('../src/index.js')

  // await auth
  await reach_auth()

  const create_account = await request(/* GraphQL */ `
    mutation {
      create_user(mail: "foo@bar.com", pwd: "foobar1")
    }
  `)

  doubt['(create user) OK']({
    because: create_account,
    is     : { data: { create_user: true } },
  })

  ENVIRONMENT.ALLOW_REGISTRATION = false

  const no_registration = await request(/* GraphQL */ `
    mutation {
      create_user(mail: "foo@bar.com", pwd: "foobar1")
    }
  `)

  ENVIRONMENT.ALLOW_REGISTRATION = true
  doubt['(create user) REGISTRATION_DISABLED']({
    because: no_registration,
    is     : { errors: ['REGISTRATION_DISABLED'] },
  })

  const mail_invalid = await request(/* GraphQL */ `
    mutation {
      create_user(mail: "foo@barcom", pwd: "foobar1")
    }
  `)

  doubt['(create user) MAIL_INVALID']({
    because: mail_invalid,
    is     : { errors: ['MAIL_INVALID'] },
  })

  const pwd_invalid = await request(/* GraphQL */ `
    mutation {
      create_user(mail: "foo@baz.com", pwd: "far1")
    }
  `)

  doubt['(create user) PASSWORD_INVALID']({
    because: pwd_invalid,
    is     : { errors: ['PASSWORD_INVALID'] },
  })

  const mail_used = await request(/* GraphQL */ `
    mutation {
      create_user(mail: "foo@bar.com", pwd: "foobar1")
    }
  `)

  doubt['(create user) MAIL_USED']({
    because: mail_used,
    is     : { errors: ['MAIL_USED'] },
  })

  const login = () =>
    request(/* GraphQL */ `
      mutation {
        create_session(mail: "foo@bar.com", pwd: "foobar1", remember: true)
      }
    `)
  const logout = () =>
    request(/* GraphQL */ `
      mutation {
        create_session(mail: "foo@bar.com", pwd: "fodwdwd5oar")
      }
    `)
  const create_session = await login()

  doubt['(create session) OK']({
    because: create_session,
    is     : { data: { create_session: true } },
  })

  const not_found = await request(/* GraphQL */ `
    mutation {
      create_session(mail: "food@bar.com", pwd: "foobar1")
    }
  `)

  doubt['(create session) USER_NOT_FOUND [1]']({
    because: not_found,
    is     : { errors: ['USER_NOT_FOUND'] },
  })

  const not_found_2 = await request(/* GraphQL */ `
    mutation {
      create_session(mail: "foo@bar.com", pwd: "fdoobar1")
    }
  `)

  doubt['(create session) USER_NOT_FOUND [2]']({
    because: not_found_2,
    is     : { errors: ['USER_NOT_FOUND'] },
  })

  const session_mail_invalid = await request(/* GraphQL */ `
    mutation {
      create_session(mail: "foobar.com", pwd: "fdoobar1")
    }
  `)

  doubt['(create session) MAIL_INVALID']({
    because: session_mail_invalid,
    is     : { errors: ['MAIL_INVALID'] },
  })

  const session_pwd_invalid = await request(/* GraphQL */ `
    mutation {
      create_session(mail: "foo@bar.com", pwd: "far1")
    }
  `)

  doubt['(create session) PASSWORD_INVALID']({
    because: session_pwd_invalid,
    is     : { errors: ['PASSWORD_INVALID'] },
  })

  const login_session = await request(/* GraphQL */ `
    mutation {
      create_session(mail: "foo@bar.com", pwd: "foobar1", remember: true)
    }
  `)

  doubt['(login session) OK']({
    because: login_session,
    is     : { data: { create_session: false } },
  })

  const invite_user = await request(/* GraphQL */ `
    mutation {
      invite_user(mail: "fooz@baz.com")
    }
  `)

  doubt['(invite user) OK']({
    because: invite_user,
    is     : { data: { invite_user: true } },
  })

  const session_no_pwd = await request(/* GraphQL */ `
    mutation {
      create_session(mail: "fooz@baz.com", pwd: "fdddar1")
    }
  `)

  doubt['(create session) NO_PASSWORD']({
    because: session_no_pwd,
    is     : { errors: ['NO_PASSWORD'] },
  })

  const session_no_ua = await request_no_ua(/* GraphQL */ `
    mutation {
      create_session(mail: "foo@bar.com", pwd: "foobar1")
    }
  `)

  doubt['(create session) ILLEGAL_SESSION']({
    because: session_no_ua,
    is     : { errors: ['ILLEGAL_SESSION'] },
  })

  ENVIRONMENT.ALLOW_REGISTRATION = false

  const invite_no_registration = await request(/* GraphQL */ `
    mutation {
      invite_user(mail: "fooz@baz.com")
    }
  `)

  ENVIRONMENT.ALLOW_REGISTRATION = true
  doubt['(invite user) REGISTRATION_DISABLED']({
    because: invite_no_registration,
    is     : { errors: ['REGISTRATION_DISABLED'] },
  })

  const invite_mail_invalid = await request_no_ua(/* GraphQL */ `
    mutation {
      invite_user(mail: "foobar.com")
    }
  `)

  doubt['(invite user) MAIL_INVALID']({
    because: invite_mail_invalid,
    is     : { errors: ['MAIL_INVALID'] },
  })

  await logout()

  const invite_not_found = await request(/* GraphQL */ `
    mutation {
      invite_user(mail: "fooss@bar.com")
    }
  `)

  doubt['(invite user) USER_NOT_FOUND']({
    because: invite_not_found,
    is     : { errors: ['USER_NOT_FOUND'] },
  })

  await login()

  const invite_mail_used = await request(/* GraphQL */ `
    mutation {
      invite_user(mail: "foo@bar.com")
    }
  `)

  doubt['(invite user) MAIL_USED']({
    because: invite_mail_used,
    is     : { errors: ['MAIL_USED'] },
  })

  const refresh_session = await request(/* GraphQL */ `
    mutation {
      refresh_session
    }
  `)

  doubt['(refresh session) OK']({
    because: refresh_session,
    is     : { data: { refresh_session: true } },
  })

  await logout()

  const refresh_session_not_found = await request(/* GraphQL */ `
    mutation {
      refresh_session
    }
  `)

  await login()
  doubt['(refresh session) USER_NOT_FOUND']({
    because: refresh_session_not_found,
    is     : { errors: ['USER_NOT_FOUND'] },
  })

  const {
    data: {
      me: { sessions, uuid: my_uid },
    },
  } = await request(/* GraphQL */ `
    {
      me {
        uuid
        sessions {
          uuid
        }
      }
    }
  `)
  const session_id = sessions[0].uuid

  await request(/* GraphQL */ `mutation{delete_session(id: "${ session_id }")}`)

  const refresh_session_illegal = await request(/* GraphQL */ `
    mutation {
      refresh_session
    }
  `)

  await login()
  doubt['(refresh session) ILLEGAL_SESSION']({
    because: refresh_session_illegal,
    is     : { errors: ['ILLEGAL_SESSION'] },
  })

  const pwd_code = await request(/* GraphQL */ `
    mutation {
      create_pwd_reset_code(mail: "foo@bar.com")
    }
  `)

  doubt['(reset code) OK']({
    because: pwd_code,
    is     : { data: { create_pwd_reset_code: true } },
  })

  const pwd_code_spam = await request(/* GraphQL */ `
    mutation {
      create_pwd_reset_code(mail: "foo@bar.com")
    }
  `)

  doubt['(reset code) SPAM']({
    because: pwd_code_spam,
    is     : { errors: ['SPAM'] },
  })

  await run`
  MATCH (u:User {uuid:${ my_uid }}) SET u.last_verification_code_sent = 0`

  const verification_code = await request(/* GraphQL */ `
    mutation {
      create_account_comfirm_code
    }
  `)

  doubt['(verification code) OK']({
    because: verification_code,
    is     : { data: { create_account_comfirm_code: true } },
  })

  await logout()

  const verification_code_not_found = await request(/* GraphQL */ `
    mutation {
      create_account_comfirm_code
    }
  `)

  await login()

  doubt['(verification code) USER_NOT_FOUND']({
    because: verification_code_not_found,
    is     : { errors: ['USER_NOT_FOUND'] },
  })

  const verification_code_spam = await request(/* GraphQL */ `
    mutation {
      create_account_comfirm_code
    }
  `)

  doubt['(verification code) SPAM']({
    because: verification_code_spam,
    is     : { errors: ['SPAM'] },
  })

  const update_pwd = await request(/* GraphQL */ `
    mutation {
      update_pwd(pwd: "admin1")
    }
  `)

  doubt['(update pwd) Updating the password while logged']({
    because: update_pwd,
    is     : { data: { update_pwd: true } },
  })

  const update_pwd_invalid = await request(/* GraphQL */ `
    mutation {
      update_pwd(pwd: "ain1")
    }
  `)

  doubt['(update pwd) PASSWORD_INVALID']({
    because: update_pwd_invalid,
    is     : { errors: ['PASSWORD_INVALID'] },
  })

  await run`
  MATCH (u:User {uuid:${ my_uid }}) SET u.last_reset_code_sent = 0`
  await request(/* GraphQL */ `
    mutation {
      create_pwd_reset_code(mail: "foo@bar.com")
    }
  `)
  await logout()

  const [{ reset_code } = {}] = await run`
  MATCH (u:User {uuid: ${ my_uid } }) RETURN u.reset_code as reset_code`
  const update_pwd_code = await request(/* GraphQL */ `
  mutation{
    update_pwd(mail: "foo@bar.com",code: "${ reset_code }",pwd: "foobar1")
    }`)

  doubt['(update pwd) Updating the password while not logged']({
    because: update_pwd_code,
    is     : { data: { update_pwd: true } },
  })

  const update_pwd_not_found = await request(/* GraphQL */ `
  mutation{
    update_pwd(mail: "foow@bar.com",code: "${ reset_code }",pwd: "admin1")
    }`)

  doubt['(update pwd) USER_NOT_FOUND']({
    because: update_pwd_not_found,
    is     : { errors: ['USER_NOT_FOUND'] },
  })

  await login()

  const update_pwd_invalid_code = await request(/* GraphQL */ `
    mutation {
      update_pwd(mail: "foo@bar.com", code: "dwdw", pwd: "admin1")
    }
  `)

  doubt['(update pwd) INVALID_CODE']({
    because: update_pwd_invalid_code,
    is     : { errors: ['INVALID_CODE'] },
  })

  const [{ verif_code } = {}] = await run`
  MATCH (u:User {uuid:${ my_uid }})
  RETURN u.verification_code AS verif_code`
  const confirm_account = await request(/* GraphQL */ `
  mutation{confirm_account(code: "${ verif_code }")}`)

  doubt['(confirm account) An account can be confirmed']({
    because: confirm_account,
    is     : { data: { confirm_account: true } },
  })

  await logout()

  const confirm_not_found = await request(/* GraphQL */ `
    mutation {
      confirm_account(code: "")
    }
  `)

  await login()
  doubt['(confirm account) USER_NOT_FOUND']({
    because: confirm_not_found,
    is     : { errors: ['USER_NOT_FOUND'] },
  })

  const confirm_invalid = await request(/* GraphQL */ `
    mutation {
      confirm_account(code: "wdwd")
    }
  `)

  doubt['(confirm account) INVALID_CODE']({
    because: confirm_invalid,
    is     : { errors: ['INVALID_CODE'] },
  })

  const {
    data: {
      me: { sessions: seshs },
    },
  } = await request(/* GraphQL */ `
    {
      me {
        uuid
        sessions {
          uuid
        }
      }
    }
  `)
  const sesh_id = seshs[0].uuid
  const delete_session_id = await request(/* GraphQL */ `
  mutation{delete_session(id:"${ sesh_id }")}`)

  doubt['(delete session) A session can be deleted by id']({
    because: delete_session_id,
    is     : { data: { delete_session: true } },
  })
  await login()

  const delete_session_current = await request(/* GraphQL */ `
    mutation {
      delete_session
    }
  `)

  doubt['(delete session) A session can be deleted']({
    because: delete_session_current,
    is     : { data: { delete_session: true } },
  })
  await logout()

  const delete_session_not_logged = await request(/* GraphQL */ `
    mutation {
      delete_session
    }
  `)

  doubt['Session deletion while not logged just remove cookies']({
    because: delete_session_not_logged,
    is     : { data: { delete_session: true } },
  })

  const check_not_logged = await request(/* GraphQL */ `
    {
      me {
        uuid
      }
    }
  `)

  doubt['Session deletion while not logged just remove cookies (check)']({
    because: check_not_logged,
    is     : { errors: ['USER_NOT_FOUND'] },
  })

  await login()
  await run`MATCH (u:User {uuid:${ my_uid }}) SET u.superadmin = true`

  const admin_delete = await request(
      /* GraphQL */ `
      mutation($ids: [ID!]!) {
        admin_delete_users(ids: $ids)
      }
    `,
      {
        ids: await run`
        MATCH (u:User) RETURN collect(u.uuid) AS ids
        `.then(([{ ids } = {}]) => ids),
      },
  )

  doubt['A superadmin can delete users']({
    because: admin_delete,
    is     : { data: { admin_delete_users: true } },
  })

  doubt['After which the db should be empty of users']({
    because: await run`
    MATCH (u:User) RETURN collect(u.uuid) AS ids
    `.then(([{ ids = [] } = {}]) => ids),
    is: [],
  })

  await request(/* GraphQL */ `
    mutation {
      create_user(mail: "foo@bar.com", pwd: "foobar1")
    }
  `)

  const admin_delete_not_found = await request(/* GraphQL */ `
    mutation {
      admin_delete_users(ids: [""])
    }
  `)

  await login()

  doubt['(admin delete users) USER_NOT_FOUND']({
    because: admin_delete_not_found,
    is     : { errors: ['USER_NOT_FOUND'] },
  })

  const admin_delete_not_authorized = await request(/* GraphQL */ `
    mutation {
      admin_delete_users(ids: [""])
    }
  `)

  doubt['(admin delete users) UNAUTHORIZED']({
    because: admin_delete_not_authorized,
    is     : { errors: ['UNAUTHORIZED'] },
  })

  const [self_uid] = await run`
  MATCH (u:User) RETURN collect(u.uuid) AS ids`.then(([{ ids }]) => ids)
  const admin_update_pwd_unauthorized = await request(/* GraphQL */ `
  mutation{admin_update_pwd(id: "${ self_uid }", pwd: "foobar2")}`)

  doubt['(admin update pwd) UNAUTHORIZED']({
    because: admin_update_pwd_unauthorized,
    is     : { errors: ['UNAUTHORIZED'] },
  })

  await run`
  MATCH (u:User {uuid:${ self_uid }}) SET u.superadmin = true`

  const admin_update_pwd = await request(/* GraphQL */ `
  mutation{admin_update_pwd(id: "${ self_uid }", pwd: "foobar1")}`)

  doubt['A superadmin can update any pwd']({
    because: admin_update_pwd,
    is     : { data: { admin_update_pwd: true } },
  })

  await logout()

  const admin_update_pwd_not_found = await request(/* GraphQL */ `
  mutation{admin_update_pwd(id: "${ self_uid }", pwd: "foobar2")}`)

  doubt['(admin update pwd) USER_NOT_FOUND']({
    because: admin_update_pwd_not_found,
    is     : { errors: ['USER_NOT_FOUND'] },
  })

  await login()
  await run`MATCH (u:User {uuid:${ self_uid }}) DELETE u`

  const admin_update_pwd_not_found_2 = await request(/* GraphQL */ `
  mutation{admin_update_pwd(id: "${ self_uid }", pwd: "foobar2")}`)

  doubt['(admin update pwd) USER_NOT_FOUND']({
    because: admin_update_pwd_not_found_2,
    is     : { errors: ['USER_NOT_FOUND'] },
  })

  auth_server.close()
  client.end(false)
} catch (error) {
  console.error(error)
} finally {
  await compose.down({
    cwd,
    log: true,
  })
}
