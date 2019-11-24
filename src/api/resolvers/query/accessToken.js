import { getId, isMailVerified, getSessionByHash } from '../../../user'
import { InvalidRefreshTokenError, SessionError } from '../../errors'

const debug = 'accessToken' |> require('debug')('auth').extend

export default async (_, __, { cors, getUser, session, makeAccessToken, sendAccessToken, makeCsrfToken }) => {
	const user = await getUser(true)
	debug('asking for an accessToken')
	debug('creating accessToken')
	const accessToken =
		session.hash |> makeAccessToken(getId(user).toString())({
			email: user.email,
			mailVerified: user |> isMailVerified
		})
	sendAccessToken(accessToken)
	// we return a CSRF token in case cors are enabled
	if (cors) return accessToken |> makeCsrfToken
}
