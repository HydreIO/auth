/* global URL */
import crypto from 'crypto'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import Token from './token.js'
import logger from './logger.js'
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

// ============= SECURITY HELPERS =============

/**
 * Validates redirect_uri against ORIGINS whitelist using URL parsing (not regex)
 * This prevents open redirect attacks by comparing scheme + host + port
 * @param {string} redirect_uri - The redirect URI to validate
 * @returns {boolean} - Whether the URI is allowed
 */
function validate_origin(redirect_uri) {
  try {
    const target = new URL(redirect_uri)
    const target_origin = target.origin // scheme + host + port

    return ENVIRONMENT.ORIGINS.split(';').some((allowed) => {
      // If it starts with ^, use regex (for backwards compat)
      if (allowed.startsWith('^')) {
        return new RegExp(allowed).test(redirect_uri)
      }
      // Otherwise, compare origins (scheme + host + port)
      try {
        const allowed_url = new URL(allowed)
        return target_origin === allowed_url.origin
      } catch {
        // If allowed is not a valid URL, try exact prefix match
        return redirect_uri.startsWith(allowed)
      }
    })
  } catch {
    return false
  }
}

/**
 * Signs state payload with HMAC-SHA256 using server's private key
 * Prevents state tampering by attackers
 * @param {object} payload - The state payload to sign
 * @returns {string} - Base64url encoded signed state
 */
function sign_state(payload) {
  const payload_json = JSON.stringify(payload)
  const payload_b64 = Buffer.from(payload_json).toString('base64url')

  // Create HMAC signature using first 32 bytes of private key hash
  const key = crypto
    .createHash('sha256')
    .update(ENVIRONMENT.PRIVATE_KEY)
    .digest()
  const signature = crypto
    .createHmac('sha256', key)
    .update(payload_b64)
    .digest('base64url')

  return `${payload_b64}.${signature}`
}

/**
 * Verifies and decodes HMAC-signed state
 * @param {string} signed_state - The signed state from callback
 * @returns {object|null} - Decoded payload or null if invalid
 */
function verify_state(signed_state) {
  try {
    const [payload_b64, signature] = signed_state.split('.')
    if (!payload_b64 || !signature) return null

    // Verify signature
    const key = crypto
      .createHash('sha256')
      .update(ENVIRONMENT.PRIVATE_KEY)
      .digest()
    const expected_sig = crypto
      .createHmac('sha256', key)
      .update(payload_b64)
      .digest('base64url')

    if (signature !== expected_sig) {
      logger.warn({ msg: 'OAuth state signature mismatch' })
      return null
    }

    return JSON.parse(Buffer.from(payload_b64, 'base64url').toString('utf8'))
  } catch (e) {
    logger.error({ msg: 'Failed to verify OAuth state', error: e.message })
    return null
  }
}

/**
 * Google OAuth 2.0 routes for hydre/auth
 * Handles OAuth flow: initiate -> Google -> callback -> session creation
 *
 * State/CSRF protection is handled by the frontend via sessionStorage.
 * The backend just builds the OAuth URL and exchanges codes for tokens.
 */

/**
 * Initiate Google OAuth flow
 * GET /oauth/google?redirect_uri=<app_url>&state=<frontend_state>
 *
 * The frontend generates and stores state in sessionStorage for CSRF protection.
 * We pass it through to Google and back to the frontend for verification.
 */
export async function initiate_google_oauth(context) {
  const { redirect_uri, state } = context.query

  if (!redirect_uri) {
    context.status = 400
    context.body = { error: 'redirect_uri query parameter required' }
    return
  }

  // SECURITY: Validate redirect_uri BEFORE redirecting to Google
  // Prevents open redirect attacks where attacker crafts malicious redirect_uri
  if (!validate_origin(redirect_uri)) {
    logger.error({
      msg: 'OAuth initiation blocked - redirect_uri not in allowed ORIGINS',
      redirect_uri,
      origins: ENVIRONMENT.ORIGINS,
    })
    context.status = 400
    context.body = { error: 'Invalid redirect URI' }
    return
  }

  // Build Google OAuth URL
  const google_auth_url = new URL(
    'https://accounts.google.com/o/oauth2/v2/auth'
  )
  google_auth_url.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  google_auth_url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
  google_auth_url.searchParams.set('response_type', 'code')
  google_auth_url.searchParams.set('scope', 'openid email profile')

  // SECURITY: HMAC-sign the state to prevent tampering
  // State contains redirect_uri - attackers could try to modify it in flight
  const signed_state = sign_state({ redirect_uri, frontend_state: state })
  google_auth_url.searchParams.set('state', signed_state)

  logger.info({
    msg: 'Initiating Google OAuth',
    redirect_uri,
    has_state: !!state,
  })

  // Redirect to Google
  context.redirect(google_auth_url.toString())
}

/**
 * Handle Google OAuth callback
 * GET /oauth/google/callback?code=<auth_code>&state=<state>&redirect_uri=<app_url>
 *
 * The frontend verifies state against sessionStorage.
 * We just exchange the code for tokens and create the session.
 */
export async function handle_google_callback(context) {
  const { code, state, error } = context.query

  // SECURITY: Verify HMAC signature and decode state
  // This prevents attackers from tampering with state (e.g., changing redirect_uri)
  let redirect_uri = null
  let frontend_state = null

  if (state) {
    const state_payload = verify_state(state)
    if (state_payload) {
      redirect_uri = state_payload.redirect_uri
      frontend_state = state_payload.frontend_state
    }
    // If verify_state returns null, logging already happened inside it
  }

  // Helper to redirect with error params
  const redirect_with_error = (target_uri, error_code, description) => {
    const error_url = new URL(target_uri)
    error_url.searchParams.set('error', error_code)
    error_url.searchParams.set('error_description', description)
    if (frontend_state) {
      error_url.searchParams.set('state', frontend_state)
    }
    context.redirect(error_url.toString())
  }

  // Validate redirect_uri was decoded from state
  if (!redirect_uri) {
    context.status = 400
    context.body = { error: 'Missing or invalid OAuth state' }
    return
  }

  // SECURITY: Validate redirect_uri using URL parsing (not regex)
  // Double-check even though initiate validated - defense in depth
  if (!validate_origin(redirect_uri)) {
    logger.error({
      msg: 'Redirect URI not in allowed ORIGINS',
      redirect_uri,
      origins: ENVIRONMENT.ORIGINS,
    })
    context.status = 400
    context.body = { error: 'Invalid redirect URI' }
    return
  }

  // Handle OAuth errors from Google
  if (error) {
    logger.error({ msg: 'Google OAuth error', error })
    redirect_with_error(redirect_uri, 'oauth_denied', error)
    return
  }

  if (!code) {
    context.status = 400
    context.body = { error: 'Missing code parameter' }
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
    const existing_user = await user_db.find_by_email(email)

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

      await user_db.create(new_user)

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
      await user_db.update(user_uuid, {
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

    // Build redirect URL with frontend_state if provided
    const success_url = new URL(redirect_uri)
    if (frontend_state) {
      success_url.searchParams.set('state', frontend_state)
    }

    // Redirect back to app - headers must not be sent yet
    if (!context.headerSent) {
      context.redirect(success_url.toString())
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
