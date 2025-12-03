import { ENVIRONMENT } from './constant.js'
import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose'

const {
  ACCESS_TOKEN_COOKIE_NAME,
  PRIVATE_KEY,
  PUBLIC_KEY,
  ACCESS_TOKEN_EXPIRATION,
  COOKIE_SAMESITE,
  COOKIE_PATH,
  COOKIE_SECURE,
  COOKIE_DOMAIN,
} = ENVIRONMENT

// Import PEM keys using jose's built-in functions
const private_key = await importPKCS8(PRIVATE_KEY, 'ES512')
const public_key = await importSPKI(PUBLIC_KEY, 'ES512')

export default (koa_context) => ({
  get: async (ignoreExpiration) => {
    try {
      const token = koa_context.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
      if (!token) return {}

      const { payload } = await jwtVerify(token, public_key, {
        ...(ignoreExpiration && { clockTolerance: Infinity }),
      })
      return payload
    } catch {
      return {}
    }
  },
  set: async (bearer) => {
    const cookie_options = {
      httpOnly: true,
      overwrite: true,
      ...(bearer.remember && { maxAge: 60000 * 60 * 24 * 365 }),
      ...(COOKIE_PATH && { path: COOKIE_PATH }),
      ...(COOKIE_SAMESITE && { sameSite: COOKIE_SAMESITE }),
      ...(COOKIE_SECURE && { secure: COOKIE_SECURE }),
      ...(COOKIE_DOMAIN && { domain: COOKIE_DOMAIN }),
    }

    const access_token = await new SignJWT(bearer)
      .setProtectedHeader({ alg: 'ES512' })
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_EXPIRATION)
      .sign(private_key)

    // Check if response already started before setting cookie
    if (koa_context.res.headersSent) {
      throw new Error('Cannot set cookie: headers already sent')
    }

    koa_context.cookies.set(
      ACCESS_TOKEN_COOKIE_NAME,
      access_token,
      cookie_options
    )

    return access_token
  },
  rm: () => {
    /* c8 ignore next 16 */
    // covered but c8 doesn't like this destruct
    const cookie_options = {
      httpOnly: true,
      overwrite: true,
      expires: new Date(0),
      ...(COOKIE_PATH && { path: COOKIE_PATH }),
      ...(COOKIE_SAMESITE && { sameSite: COOKIE_SAMESITE }),
      ...(COOKIE_SECURE && { secure: COOKIE_SECURE }),
      ...(COOKIE_DOMAIN && { domain: COOKIE_DOMAIN }),
    }

    koa_context.cookies.set(
      ACCESS_TOKEN_COOKIE_NAME,
      'buy bitcoin :)',
      cookie_options
    )
  },
})
