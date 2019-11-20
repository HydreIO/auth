import { getId, isMailVerified, getSessionByHash } from '../../../user'
import { InvalidRefreshTokenError, SessionError } from '../../errors'

const debug = 'accessToken' |> require('debug')('auth').extend

export default async (_, { cors, getUser, refreshToken, session, makeAccessToken, sendAccessToken, makeCsrfToken }) =>
	(await getUser())
	|> (_ => (debug('asking for an accessToken'), _))
	|> (user => {
		debug('verifying refresh token')
		const sess = getSessionByHash(session.hash)(user) || throw new SessionError()
		if (sess.refreshToken !== refreshToken) throw new InvalidRefreshTokenError()
		debug('creating accessToken')
		const accessToken =
			session.hash |> makeAccessToken(getId(user).toString())({
				email: user.email,
				mailVerified: user |> isMailVerified
			})
		debug('created [%s]', accessToken)
		accessToken |> sendAccessToken
		// we return a CSRF token in case cors are enabled
		if (cors) return accessToken |> makeCsrfToken
	})
