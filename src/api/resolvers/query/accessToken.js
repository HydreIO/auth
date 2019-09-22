import { getId, isMailVerified,getSessionByHash } from '../../../user'
import { InvalidRefreshTokenError, SessionError} from '../../errors'

const debug = 'accessToken' |> require('debug')('auth').extend

export default async (_, { getUser,refreshToken, session, makeAccessToken, sendAccessToken, makeCsrfToken }) =>
	(await getUser())
	|> (_ => (debug('asking for an accessToken'), _))
	|> (user => {
		debug('verifying refresh token')
		const sess = getSessionByHash(session.hash)(user) || throw new SessionError()
		if(sess.refreshToken !== refreshToken) throw new InvalidRefreshTokenError()
		debug('creating accessToken')
		const accessToken =
			session.hash |> makeAccessToken(getId(user).toString())(user |> isMailVerified)
		debug('created [%s]', accessToken)
		accessToken |> sendAccessToken
		return accessToken |> makeCsrfToken
	})
