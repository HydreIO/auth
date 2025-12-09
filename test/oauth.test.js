import { describe, test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import compose from 'docker-compose'
import fetch from 'node-fetch'
import fetch_cookie from 'fetch-cookie'
import tough from 'tough-cookie'

const host = 'http://localhost:3000'
const cwd = process.cwd()

// Setup cookie jar for session management
const cookie_jar = new tough.CookieJar(new tough.MemoryCookieStore(), {
  rejectPublicSuffixes: false,
  allowSpecialUseDomain: true,
})
const cookie_fetch = fetch_cookie(fetch, cookie_jar)

// Helper to wait for auth server to be ready
const wait_for_auth = async () => {
  try {
    await fetch(`${host}/healthz`)
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await wait_for_auth()
  }
}

describe('OAuth Flow', () => {
  let auth_server
  let original_fetch

  before(async () => {
    // Start Docker Compose infrastructure
    await compose.upAll({
      cwd,
      log: true,
      commandOptions: ['--build'],
    })

    // Wait for infrastructure
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Import and start auth server
    const module = await import('../src/index.js')
    auth_server = module.default

    // Wait for server to be ready
    await wait_for_auth()

    // Save original fetch for restoration
    original_fetch = globalThis.fetch
  })

  after(async () => {
    // Cleanup
    auth_server.close()
    await compose.down({ cwd, log: true })

    // Restore original fetch
    globalThis.fetch = original_fetch
  })

  describe('GET /oauth/google (Initiate OAuth)', () => {
    test('redirects to Google with state passed through', async () => {
      const redirect_uri = 'https://myapp.com/dashboard'
      const state = 'frontend_generated_state_token'
      const response = await fetch(
        `${host}/oauth/google?redirect_uri=${encodeURIComponent(redirect_uri)}&state=${state}`,
        {
          redirect: 'manual', // Don't follow redirects automatically
        }
      )

      // Should return 302 redirect
      assert.strictEqual(response.status, 302)

      // Extract redirect location
      const location = response.headers.get('location')
      assert.ok(location)
      assert.ok(
        location.startsWith('https://accounts.google.com/o/oauth2/v2/auth')
      )

      // Parse redirect URL
      const redirect_url = new globalThis.URL(location)
      // Just verify the params exist (env vars may not be set in test)
      assert.ok(redirect_url.searchParams.get('client_id'))
      assert.ok(redirect_url.searchParams.get('redirect_uri'))
      assert.strictEqual(redirect_url.searchParams.get('response_type'), 'code')
      assert.strictEqual(
        redirect_url.searchParams.get('scope'),
        'openid email profile'
      )

      // State token should be passed through from frontend
      assert.strictEqual(redirect_url.searchParams.get('state'), state)
    })

    test('redirects without state if not provided', async () => {
      const redirect_uri = 'https://myapp.com/dashboard'
      const response = await fetch(
        `${host}/oauth/google?redirect_uri=${encodeURIComponent(redirect_uri)}`,
        {
          redirect: 'manual',
        }
      )

      assert.strictEqual(response.status, 302)

      const location = response.headers.get('location')
      const redirect_url = new globalThis.URL(location)
      assert.strictEqual(redirect_url.searchParams.get('state'), null)
    })

    test('returns 400 if redirect_uri is missing', async () => {
      const response = await fetch(`${host}/oauth/google`)

      assert.strictEqual(response.status, 400)

      const body = await response.json()
      assert.strictEqual(body.error, 'redirect_uri query parameter required')
    })
  })

  describe('GET /oauth/google/callback (Handle OAuth callback)', () => {
    test('creates new user and session on successful OAuth', async () => {
      const state = 'test_state_token_' + Date.now()
      const redirect_uri = 'https://myapp.com/dashboard'

      // Mock Google token exchange
      const mock_google_id = 'google_user_123'
      const mock_email = 'test@example.com'
      const mock_name = 'Test User'
      const mock_picture = 'https://example.com/avatar.jpg'

      // Create mock ID token (base64url encoded payload)
      const id_token_payload = {
        sub: mock_google_id,
        email: mock_email,
        name: mock_name,
        picture: mock_picture,
        iat: Date.now(),
        exp: Date.now() + 3600,
      }
      const payload_base64 = Buffer.from(
        JSON.stringify(id_token_payload)
      ).toString('base64url')
      const mock_id_token = `header.${payload_base64}.signature`

      // Mock fetch for token exchange
      const mocked_fetch = mock.fn(async (url, options) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          return {
            ok: true,
            json: async () => ({
              id_token: mock_id_token,
              access_token: 'mock_access_token',
            }),
          }
        }
        // Fallback to real fetch for other URLs
        return original_fetch(url, options)
      })

      // Replace global fetch temporarily
      globalThis.fetch = mocked_fetch

      try {
        // Make callback request - redirect_uri is now passed as query param
        const response = await cookie_fetch(
          `${host}/oauth/google/callback?code=mock_auth_code&state=${state}&redirect_uri=${encodeURIComponent(redirect_uri)}`,
          {
            redirect: 'manual', // Don't follow redirects
          }
        )

        // Should redirect back to app with state
        assert.strictEqual(response.status, 302)
        const location = response.headers.get('location')
        const location_url = new globalThis.URL(location)
        assert.strictEqual(
          location_url.origin + location_url.pathname,
          redirect_uri
        )
        assert.strictEqual(location_url.searchParams.get('state'), state)

        // Verify fetch was called with correct params
        assert.strictEqual(mocked_fetch.mock.calls.length, 1)
        const [fetch_url, fetch_options] = mocked_fetch.mock.calls[0].arguments
        assert.strictEqual(fetch_url, 'https://oauth2.googleapis.com/token')

        const request_body = JSON.parse(fetch_options.body)
        assert.strictEqual(request_body.code, 'mock_auth_code')
        assert.strictEqual(request_body.client_id, process.env.GOOGLE_CLIENT_ID)
        assert.strictEqual(
          request_body.client_secret,
          process.env.GOOGLE_CLIENT_SECRET
        )
        assert.strictEqual(request_body.grant_type, 'authorization_code')
      } finally {
        // Restore global fetch
        globalThis.fetch = original_fetch
      }
    })

    test('returns 400 if redirect_uri is missing', async () => {
      const response = await fetch(
        `${host}/oauth/google/callback?code=some_code&state=some_state`
      )

      assert.strictEqual(response.status, 400)
      const body = await response.json()
      assert.strictEqual(body.error, 'redirect_uri query parameter required')
    })

    test('returns 400 if redirect_uri is not in allowed ORIGINS', async () => {
      const response = await fetch(
        `${host}/oauth/google/callback?code=some_code&state=some_state&redirect_uri=${encodeURIComponent('https://evil.com/steal')}`
      )

      assert.strictEqual(response.status, 400)
      const body = await response.json()
      assert.strictEqual(body.error, 'Invalid redirect URI')
    })

    test('returns 400 if code is missing', async () => {
      const redirect_uri = 'https://myapp.com/dashboard'
      const response = await fetch(
        `${host}/oauth/google/callback?state=some_state&redirect_uri=${encodeURIComponent(redirect_uri)}`
      )

      assert.strictEqual(response.status, 400)
      const body = await response.json()
      assert.strictEqual(body.error, 'Missing code parameter')
    })

    test('redirects with error if Google returns OAuth error', async () => {
      const redirect_uri = 'https://myapp.com/dashboard'
      const state = 'some_state'
      const response = await fetch(
        `${host}/oauth/google/callback?error=access_denied&state=${state}&redirect_uri=${encodeURIComponent(redirect_uri)}`,
        {
          redirect: 'manual',
        }
      )

      assert.strictEqual(response.status, 302)
      const location = response.headers.get('location')
      const location_url = new globalThis.URL(location)
      assert.strictEqual(location_url.searchParams.get('error'), 'oauth_denied')
      assert.strictEqual(
        location_url.searchParams.get('error_description'),
        'access_denied'
      )
      assert.strictEqual(location_url.searchParams.get('state'), state)
    })

    test('redirects with error if token exchange fails', async () => {
      const redirect_uri = 'https://myapp.com/dashboard'
      const state = 'test_state_fail_' + Date.now()

      // Mock failed token exchange
      const mocked_fetch = mock.fn(async (url) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          return {
            ok: false,
            json: async () => ({ error: 'invalid_grant' }),
          }
        }
        return original_fetch(url)
      })

      globalThis.fetch = mocked_fetch

      try {
        const response = await fetch(
          `${host}/oauth/google/callback?code=bad_code&state=${state}&redirect_uri=${encodeURIComponent(redirect_uri)}`,
          {
            redirect: 'manual',
          }
        )

        assert.strictEqual(response.status, 302)
        const location = response.headers.get('location')
        const location_url = new globalThis.URL(location)
        assert.strictEqual(
          location_url.searchParams.get('error'),
          'token_exchange_failed'
        )
        assert.strictEqual(location_url.searchParams.get('state'), state)
      } finally {
        globalThis.fetch = original_fetch
      }
    })
  })
})
