/* global URL */
import crypto from 'crypto'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import Token from './token.js'
import logger from './logger.js'
import { master_client } from './io/index.js'
import { user_db } from './database.js'
import { ENVIRONMENT, ERRORS, validate_email_whitelist } from './constant.js'
import MAIL from './mail.js'

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
  process.env

// Google's JWKS endpoint for JWT verification
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
)

// Validate OAuth configuration
if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_SECRET) {
  throw new Error(
    'CRITICAL: GOOGLE_CLIENT_SECRET is required when GOOGLE_CLIENT_ID is set'
  )
}

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

  // Helper to redirect with error params
  const redirect_with_error = (target_uri, error_code, description) => {
    const error_url = new URL(target_uri)
    error_url.searchParams.set('error', error_code)
    error_url.searchParams.set('error_description', description)
    context.redirect(error_url.toString())
  }

  // Handle OAuth errors from Google
  // Note: redirect_uri not available yet, try to recover from state
  if (error) {
    logger.error({ msg: 'Google OAuth error', error })
    // Attempt to get redirect_uri from state for better UX
    if (state) {
      const stored_uri = await master_client.getdel(`oauth_state:${state}`)
      if (stored_uri) {
        redirect_with_error(stored_uri, 'oauth_denied', error)
        return
      }
    }
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
      redirect_with_error(
        redirect_uri,
        'token_exchange_failed',
        'Failed to complete authentication with Google'
      )
      return
    }

    const { id_token } = await token_response.json()

    // Verify JWT signature and claims using jose library (CRITICAL SECURITY FIX)
    const { payload } = await jwtVerify(id_token, GOOGLE_JWKS, {
      issuer: 'https://accounts.google.com',
      audience: GOOGLE_CLIENT_ID,
    })

    const { email, sub: google_id, name, picture } = payload

    logger.info({
      msg: 'Google OAuth successful',
      email,
      google_id,
    })

    // Validate email against whitelist
    try {
      validate_email_whitelist(email)
    } catch {
      logger.warn({
        msg: 'Email not in whitelist',
        email,
      })
      throw new Error(ERRORS.UNAUTHORIZED)
    }

    // Check if user exists using database layer
    const existing_user = await user_db.find_by_email(master_client, email)

    let user_uuid

    if (!existing_user) {
      // Create new user using database layer
      user_uuid = crypto.randomUUID()
      const new_user = {
        uuid: user_uuid,
        mail: email,
        google_id,
        name,
        picture,
        confirmed: true, // OAuth users are auto-confirmed
        member_since: Date.now(),
        auth_method: 'google',
      }

      await user_db.create(master_client, new_user)

      logger.info({ msg: 'Created new Google OAuth user', user_uuid, email })
    } else {
      user_uuid = existing_user.uuid

      // Prevent account takeover: only merge if auth methods match
      if (existing_user.auth_method && existing_user.auth_method !== 'google') {
        logger.warn({
          msg: 'Account exists with different auth method',
          email,
          existing_method: existing_user.auth_method,
        })
        throw new Error(
          'This email is already registered with a different authentication method. Please use your original login method.'
        )
      }

      // Determine what changed for notification
      const changes = []
      if (existing_user.name !== name) changes.push('name')
      if (existing_user.picture !== picture) changes.push('profile picture')

      // Update user info from Google
      await user_db.update(master_client, user_uuid, {
        name,
        picture,
        google_id,
        auth_method: 'google', // Ensure auth_method is set
      })

      // Send notification if profile changed
      if (changes.length > 0 && ENVIRONMENT.ENABLE_EMAIL) {
        await MAIL.send([
          MAIL.PROFILE_UPDATED,
          email,
          'en',
          undefined,
          JSON.stringify({ changes: changes.join(', ') }),
        ])
      }

      logger.info({
        msg: 'Updated existing user from Google',
        user_uuid,
        email,
        changes,
      })
    }

    // Build session data with device fingerprint (similar to GraphQL path)
    const ip =
      context.req.headers['x-forwarded-for']?.split(',')?.[0] || context.ip
    const ua = context.req.headers['user-agent'] || ''

    // Parse user agent for device metadata
    const { UAParser } = await import('ua-parser-js')
    const parser = new UAParser(ua)
    const { name: browserName } = parser.getBrowser()
    const {
      model: deviceModel,
      type: deviceType,
      vendor: deviceVendor,
    } = parser.getDevice()
    const { name: osName } = parser.getOS()

    const session_fields = {
      ip,
      browserName,
      deviceModel,
      deviceType,
      deviceVendor,
      osName,
    }

    const session_hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(session_fields))
      .digest('hex')

    const session_data = {
      ...session_fields,
      hash: session_hash,
    }

    // Use shared session gate (no language for OAuth, no publish, no logged_once tracking)
    const { create_or_update_session } = await import('./session_gate.js')
    const { session_uuid } = await create_or_update_session({
      redis: master_client,
      user_uuid,
      user_email: email,
      session_data,
      lang: 'en', // Default language for OAuth
      publish: null, // No publish for OAuth
      should_mark_logged_once: false, // OAuth doesn't track logged_once
    })

    // Set auth token cookie BEFORE redirect
    // Note: Must set cookie before any response is sent
    const token = Token(context)
    await token.set({ uuid: user_uuid, session: session_uuid })

    logger.info({
      msg: 'Created OAuth session',
      user_uuid,
      session_uuid,
    })

    // Validate redirect_uri against ORIGINS whitelist to prevent open redirect
    const is_allowed = ENVIRONMENT.ORIGINS.split(';').some((pattern) => {
      const anchored = pattern.startsWith('^') ? pattern : `^${pattern}$`
      return new RegExp(anchored).test(redirect_uri)
    })
    if (!is_allowed) {
      logger.error({
        msg: 'Redirect URI not in allowed ORIGINS',
        redirect_uri,
        origins: ENVIRONMENT.ORIGINS,
      })
      throw new Error('Invalid redirect URI')
    }

    // Redirect back to app - headers must not be sent yet
    if (!context.headerSent) {
      context.redirect(redirect_uri)
    } else {
      logger.error({
        msg: 'Headers already sent, cannot redirect',
        redirect_uri,
      })
    }
  } catch (error) {
    logger.error({ msg: 'Google OAuth callback error', error: error.message })

    // Map specific error messages to user-friendly descriptions
    let error_code = 'auth_failed'
    let error_description = 'OAuth authentication failed'

    if (error.message === ERRORS.UNAUTHORIZED) {
      error_code = 'registration_disabled'
      error_description = 'Registration is disabled for this email'
    } else if (error.message?.includes('different authentication method')) {
      error_code = 'auth_method_mismatch'
      error_description = error.message
    } else if (error.message === 'Invalid redirect URI') {
      // Cannot redirect to an invalid URI - fall back to JSON error
      context.status = 400
      context.body = { error: 'Invalid redirect URI' }
      return
    }

    redirect_with_error(redirect_uri, error_code, error_description)
  }
}
