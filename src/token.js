import { ENVIRONMENT } from './constant.js'
import jwt from 'jsonwebtoken'

export default koa_context => ({
  get: ignoreExpiration => {
    try {
      return jwt.verify(
          koa_context.cookies.get(ENVIRONMENT.ACCESS_TOKEN_COOKIE_NAME),
          ENVIRONMENT.PUBLIC_KEY,
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
    koa_context.cookies.set(
        ENVIRONMENT.ACCESS_TOKEN_COOKIE_NAME,
        jwt.sign(bearer, ENVIRONMENT.PRIVATE_KEY, {
          algorithm: 'ES512',
          expiresIn: ENVIRONMENT.ACCESS_TOKEN_EXPIRATION,
        }),
        {
          httpOnly: true,
          secure  : ENVIRONMENT.COOKIE_SECURE,
          sameSite: ENVIRONMENT.COOKIE_SAMESITE,
          path    : ENVIRONMENT.COOKIE_PATH,
          ...bearer.remember && { maxAge: '1y' },
          ...ENVIRONMENT.COOKIE_DOMAIN && { domain: ENVIRONMENT.COOKIE_DOMAIN },
        },
    )
  },
  rm: () => {
    koa_context.cookies.set(ENVIRONMENT.ACCESS_TOKEN_COOKIE_NAME)
  },
})
