import { ENVIRONMENT } from './constant.js'
import jwt from 'jsonwebtoken'

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

export default koa_context => ({
  get: ignoreExpiration => {
    try {
      return jwt.verify(
          koa_context.cookies.get(ACCESS_TOKEN_COOKIE_NAME),
          PUBLIC_KEY,
          {
            algorithms: 'ES512',
            ignoreExpiration,
          },
      )
    } catch {
      return {}
    }
  },
  set: bearer => {
    const cookie_options = {
      httpOnly: true,
      ...bearer.remember && { maxAge: 60000 * 60 * 24 * 365 },
      ...COOKIE_PATH && { path: COOKIE_PATH },
      ...COOKIE_SAMESITE && { sameSite: COOKIE_SAMESITE },
      ...COOKIE_SECURE && { secure: COOKIE_SECURE },
      ...COOKIE_DOMAIN && { domain: COOKIE_DOMAIN },
    }
    const access_token = jwt.sign(bearer, PRIVATE_KEY, {
      algorithm: 'ES512',
      expiresIn: ACCESS_TOKEN_EXPIRATION,
    })

    koa_context.cookies.set(
        ACCESS_TOKEN_COOKIE_NAME,
        access_token,
        cookie_options,
    )
  },
  rm: () => {
    koa_context.cookies.set(ACCESS_TOKEN_COOKIE_NAME)
  },
})
