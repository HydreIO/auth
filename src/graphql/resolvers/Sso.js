import { UnknowProviderError, RegistrationDisabledError } from '../errors'

const debug = require('debug')('auth').extend('sso')

const signWithGoogle = async (idToken, { verifyGoogleIdToken }, { fetch, push }, env) => {
	debug('verifying google id_token')
	const { userid, email } = await verifyGoogleIdToken(idToken)
	debug('finding user with google id')
	const userDatas = { sso: { google: userid } }
	const user = (await fetch(userDatas)) || {}
	if (!user) {
		debug(`user doesn't exist yet`)
		env.ALLOW_REGISTRATION || throw new RegistrationDisabledError()
		Object.assign(user, { email, ...userDatas })
		debug('saving user to retrieve userid')
		user._id = (await push(user)).insertedId
		user[Symbol.transient].newAccount = true
	}
	return user
}

export const sign = async (_, { provider, idToken }, { sso, userIops, env, eventOps: { parseUserAgent }, userOps: { loadAccessToken, loadRefreshToken } }) => {
	const user = {}
	switch (provider) {
		case GOOGLE:
			Object.assign(user, await signWithGoogle(idToken, sso, userIops, env))
			break;
		default:
			throw new UnknowProviderError()
	}
	user |> loadSession(env.IP, parseUserAgent()) |> loadRefreshToken(env) |> loadAccessToken(env)
	debug('saving user..') // in case of a new session
	await push(user)
	debug('fixing tokens..')
	sendRefreshToken(user[Symbol.transient].session.refreshToken)
	sendAccessToken(user[Symbol.transient].accessToken, rememberMe)
	return { user: { id: user._id, sessions: user.sessions, verified: user.verified }, newAccount: !!user[Symbol.transient].newAccount, newSession: !!user[Symbol.transient].newSession }
}