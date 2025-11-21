/* global URL */
import crypto from 'crypto'
import Token from './token.js'
import logger from './logger.js'
import { master_client } from './sentinel.js'

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
  process.env

/**
 * Google OAuth 2.0 routes for hydre/auth
 * Handles OAuth flow: initiate → Google → callback → session creation
 */

/**
 * Initiate Google OAuth flow
 * GET /oauth/google?redirect_uri=<app_url>
 */
export async function initiate_google_oauth(context) {
  const { redirect_uri } = context.query

  if (!redirect_uri) {
    context.status = 400
    context.body = { error: 'redirect_uri query parameter required' }
    return
  }

  // Generate state token to prevent CSRF
  const state = crypto.randomBytes(32).toString('hex')

  // Store state + redirect_uri in Redis (expires in 10 minutes)
  await master_client.setex(
    `oauth_state:${state}`,
    600, // 10 minutes TTL
    redirect_uri
  )

  // Build Google OAuth URL
  const google_auth_url = new URL(
    'https://accounts.google.com/o/oauth2/v2/auth'
  )
  google_auth_url.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  google_auth_url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
  google_auth_url.searchParams.set('response_type', 'code')
  google_auth_url.searchParams.set('scope', 'openid email profile')
  google_auth_url.searchParams.set('state', state)

  logger.info({
    msg: 'Initiating Google OAuth',
    state,
    redirect_uri,
  })

  // Redirect to Google
  context.redirect(google_auth_url.toString())
}

/**
 * Handle Google OAuth callback
 * GET /oauth/google/callback?code=<auth_code>&state=<state>
 */
export async function handle_google_callback(context) {
  const { code, state, error } = context.query

  // Handle OAuth errors from Google
  if (error) {
    logger.error({ msg: 'Google OAuth error', error })
    context.status = 400
    context.body = { error: `Google OAuth failed: ${error}` }
    return
  }

  if (!code || !state) {
    context.status = 400
    context.body = { error: 'Missing code or state parameter' }
    return
  }

  // Verify state and get original redirect_uri
  const redirect_uri = await master_client.getdel(`oauth_state:${state}`)

  if (!redirect_uri) {
    logger.warn({ msg: 'Invalid or expired OAuth state', state })
    context.status = 400
    context.body = { error: 'Invalid or expired state parameter' }
    return
  }

  try {
    // Exchange auth code for tokens
    const token_response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    if (!token_response.ok) {
      const error_data = await token_response.json()
      logger.error({ msg: 'Failed to exchange OAuth code', error: error_data })
      throw new Error('Token exchange failed')
    }

    const { id_token } = await token_response.json()

    // Decode ID token to get user info (without verification for simplicity)
    const [, payload_b64] = id_token.split('.')
    const payload = JSON.parse(Buffer.from(payload_b64, 'base64url').toString())
    const { email, sub: google_id, name, picture } = payload

    logger.info({
      msg: 'Google OAuth successful',
      email,
      google_id,
    })

    // Check if user exists
    const user_key = `user:${email}`
    const existing_user_json = await master_client.get(user_key)
    const existing_user = existing_user_json
      ? JSON.parse(existing_user_json)
      : null

    let user_id

    if (!existing_user) {
      // Create new user
      user_id = crypto.randomUUID()
      const new_user = {
        user_id,
        email,
        google_id,
        name,
        picture,
        confirmed: true, // OAuth users are auto-confirmed
        created_at: Date.now(),
        auth_method: 'google',
      }

      await master_client.set(user_key, JSON.stringify(new_user))
      await master_client.set(`user_by_id:${user_id}`, JSON.stringify(new_user))

      logger.info({ msg: 'Created new Google OAuth user', user_id, email })
    } else {
      ;({ user_id } = existing_user)

      // Update user info from Google
      existing_user.name = name
      existing_user.picture = picture
      existing_user.google_id = google_id

      await master_client.set(user_key, JSON.stringify(existing_user))
      await master_client.set(
        `user_by_id:${user_id}`,
        JSON.stringify(existing_user)
      )

      logger.info({ msg: 'Updated existing user from Google', user_id, email })
    }

    // Create session (reuse existing session creation logic)
    const session_id = crypto.randomUUID()
    const session_hash = crypto.randomBytes(16).toString('hex')

    const session = {
      session_id,
      user_id,
      email,
      hash: session_hash,
      created_at: Date.now(),
      ip: context.req.headers['x-forwarded-for']?.split(',')?.[0] || context.ip,
    }

    await master_client.set(`session:${session_id}`, JSON.stringify(session))

    // Set auth token cookie
    const token = Token(context)
    await token.set({ user_id, session_id })

    logger.info({
      msg: 'Created OAuth session',
      user_id,
      session_id,
    })

    // Redirect back to app
    context.redirect(redirect_uri)
  } catch (error) {
    logger.error({ msg: 'Google OAuth callback error', error: error.message })
    context.status = 500
    context.body = { error: 'OAuth authentication failed' }
  }
}
