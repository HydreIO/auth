import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { GraphQLClient } from 'graphql-request'
import Redis from 'ioredis'
import compose from 'docker-compose'
import zmq from 'zeromq'
import fetch from 'node-fetch'
import fetch_cookie from 'fetch-cookie'
import tough from 'tough-cookie'
import { ENVIRONMENT } from '../src/constant.js'

// Setup cookie jar for session management
globalThis.fetch = fetch_cookie(
  fetch,
  new tough.CookieJar(new tough.MemoryCookieStore(), {
    rejectPublicSuffixes: false,
    allowSpecialUseDomain: true,
  })
)

const host = 'http://localhost:3000'
const cwd = process.cwd()

// Helper to create GraphQL client with custom headers
const create_client = (headers = {}, use_new_jar = false) => {
  const client_options = {
    headers: {
      'user-agent':
        'Opera/9.30 (Nintendo Wii; U; ; 2071; Wii Shop Channel/1.0; en)',
      ...headers,
    },
    credentials: 'include',
    mode: 'cors',
  }

  // Create client with isolated cookie jar if requested
  if (use_new_jar) {
    const isolated_fetch = fetch_cookie(
      fetch,
      new tough.CookieJar(new tough.MemoryCookieStore(), {
        rejectPublicSuffixes: false,
        allowSpecialUseDomain: true,
      })
    )
    client_options.fetch = isolated_fetch
  }

  return new GraphQLClient(host, client_options)
}

// Helper to wait for auth server to be ready
const wait_for_auth = async () => {
  try {
    await fetch(`${host}/healthz`)
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await wait_for_auth()
  }
}

// Helper to make GraphQL requests and handle errors
const request = async (client, query, variables) => {
  try {
    const result = await client.request(query, variables)
    return { data: result }
  } catch (error) {
    if (error.response?.errors) {
      return { errors: error.response.errors.map(({ message }) => message) }
    }
    // Handle unexpected errors
    return { errors: [error.message || 'Unknown error'] }
  }
}

describe('Authentication Server', () => {
  let auth_server
  let redis_client
  let mail_socket
  let gql

  before(async () => {
    // Start Docker Compose infrastructure
    await compose.upAll({
      cwd,
      log: true,
      commandOptions: ['--build'],
    })

    // Setup Redis client
    redis_client = new Redis({
      host: '0.0.0.0',
      port: 6379,
    })

    // Wait for Redis to be ready
    await new Promise((resolve) => redis_client.once('ready', resolve))

    // Setup mail socket
    mail_socket = new zmq.Pull()
    mail_socket.connect('tcp://0.0.0.0:3001')

    // Import and start auth server
    const module = await import('../src/index.js')
    auth_server = module.default

    // Wait for auth server to be ready
    await wait_for_auth()

    // Create GraphQL client
    gql = create_client()
  })

  after(async () => {
    // Cleanup
    if (auth_server) auth_server.close()
    if (redis_client) await redis_client.quit()
    if (mail_socket) await mail_socket.close()

    // Tear down Docker Compose
    await compose.down({
      cwd,
      log: true,
    })
  })

  describe('User Registration', () => {
    test('should create a new user successfully', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_user(mail: "foo@bar.com", pwd: "foobar1")
          }
        `
      )

      assert.deepEqual(result, { data: { create_user: true } })
    })

    test('should reject registration when disabled', async () => {
      const original = ENVIRONMENT.ALLOW_REGISTRATION
      ENVIRONMENT.ALLOW_REGISTRATION = false

      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_user(mail: "test@example.com", pwd: "test123")
          }
        `
      )

      assert.deepEqual(result, { errors: ['REGISTRATION_DISABLED'] })
      ENVIRONMENT.ALLOW_REGISTRATION = original
    })

    test('should reject invalid email', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_user(mail: "invalid-email", pwd: "foobar1")
          }
        `
      )

      assert.deepEqual(result, { errors: ['MAIL_INVALID'] })
    })

    test('should reject weak password', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_user(mail: "test@example.com", pwd: "weak")
          }
        `
      )

      assert.deepEqual(result, { errors: ['PASSWORD_INVALID'] })
    })

    test('should reject duplicate email', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_user(mail: "foo@bar.com", pwd: "foobar1")
          }
        `
      )

      assert.deepEqual(result, { errors: ['MAIL_USED'] })
    })
  })

  describe('Session Management', () => {
    test('should create session (login) successfully', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_session(mail: "foo@bar.com", pwd: "foobar1", remember: true)
          }
        `
      )

      assert.deepEqual(result, { data: { create_session: true } })
    })

    test('should reject login with invalid credentials', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_session(mail: "foo@bar.com", pwd: "wrongpass1")
          }
        `
      )

      assert.deepEqual(result, { errors: ['USER_NOT_FOUND'] })
    })

    test('should reject login with non-existent user', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_session(mail: "nonexistent@example.com", pwd: "foobar1")
          }
        `
      )

      assert.deepEqual(result, { errors: ['USER_NOT_FOUND'] })
    })

    test('should reject login with invalid email format', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_session(mail: "invalid", pwd: "foobar1")
          }
        `
      )

      assert.deepEqual(result, { errors: ['MAIL_INVALID'] })
    })

    test('should reject login with invalid password format', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_session(mail: "foo@bar.com", pwd: "weak")
          }
        `
      )

      assert.deepEqual(result, { errors: ['PASSWORD_INVALID'] })
    })

    test('should handle existing session (relogin)', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_session(mail: "foo@bar.com", pwd: "foobar1", remember: true)
          }
        `
      )

      assert.deepEqual(result, { data: { create_session: false } })
    })
  })

  describe('User Invitation', () => {
    test('should invite user successfully', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            invite_user(mail: "invited@example.com")
          }
        `
      )

      assert.ok(result.data?.invite_user)
      assert.equal(typeof result.data.invite_user, 'string')
    })

    test('should reject login for invited user without password', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_session(mail: "invited@example.com", pwd: "somepass1")
          }
        `
      )

      assert.deepEqual(result, { errors: ['NO_PASSWORD'] })
    })
  })

  describe('User Query', () => {
    test('should get current user info', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          query {
            me {
              mail
            }
          }
        `
      )

      assert.ok(result.data?.me?.mail)
      assert.equal(result.data.me.mail, 'foo@bar.com')
    })

    test('should require authentication', async () => {
      // Create new client without session (isolated cookie jar)
      const unauthenticated_client = create_client({}, true)

      const result = await request(
        unauthenticated_client,
        /* GraphQL */ `
          query {
            me {
              mail
            }
          }
        `
      )

      assert.ok(result.errors)
    })
  })

  describe('Session Operations', () => {
    test('should reject session without user agent', async () => {
      const no_ua_client = new GraphQLClient(host, {
        credentials: 'include',
        mode: 'cors',
      })

      const result = await request(
        no_ua_client,
        /* GraphQL */ `
          mutation {
            create_session(mail: "foo@bar.com", pwd: "foobar1", remember: true)
          }
        `
      )

      assert.deepEqual(result, { errors: ['ILLEGAL_SESSION'] })
    })

    test('should refresh session successfully', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            refresh_session
          }
        `
      )

      assert.deepEqual(result, { data: { refresh_session: true } })
    })

    test('should delete session (logout) successfully', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            delete_session
          }
        `
      )

      assert.deepEqual(result, { data: { delete_session: true } })
    })
  })

  describe('Account Confirmation', () => {
    test('should create account confirmation code after delay', async () => {
      // Create a dedicated user for confirmation testing
      await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_user(mail: "confirm@test.com", pwd: "confirm1", lang: EN)
          }
        `
      )

      // Wait 6 seconds to avoid SPAM rate limit (CONFIRM_ACCOUNT_DELAY = 5s)
      await new Promise((resolve) => setTimeout(resolve, 6000))

      // Login with the new user
      await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_session(mail: "confirm@test.com", pwd: "confirm1", remember: true)
          }
        `
      )

      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_account_confirm_code(lang: EN)
          }
        `
      )

      assert.deepEqual(result, { data: { create_account_confirm_code: true } })
    })

    test('should reject confirmation with invalid code', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            confirm_account(code: "invalid-code")
          }
        `
      )

      assert.deepEqual(result, { errors: ['INVALID_CODE'] })
    })
  })

  describe('Password Management', () => {
    test('should update password while logged in', async () => {
      // Login first
      await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_session(mail: "foo@bar.com", pwd: "foobar1", remember: true)
          }
        `
      )

      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            update_pwd_logged(current_pwd: "foobar1", new_pwd: "newpass1")
          }
        `
      )

      assert.deepEqual(result, { data: { update_pwd_logged: true } })
    })

    test('should reject password update with invalid new password', async () => {
      // Login again with new password
      await request(
        gql,
        /* GraphQL */ `
          mutation {
            create_session(mail: "foo@bar.com", pwd: "newpass1", remember: true)
          }
        `
      )

      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            update_pwd_logged(current_pwd: "newpass1", new_pwd: "weak")
          }
        `
      )

      assert.deepEqual(result, { errors: ['PASSWORD_INVALID'] })
    })

    test('should reject password update with wrong current password', async () => {
      const result = await request(
        gql,
        /* GraphQL */ `
          mutation {
            update_pwd_logged(current_pwd: "wrongpass1", new_pwd: "newpass2")
          }
        `
      )

      assert.deepEqual(result, { errors: ['USER_NOT_FOUND'] })
    })
  })
})
