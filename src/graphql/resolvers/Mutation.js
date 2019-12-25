import { InvalidRefreshTokenError } from '../errors'
const debug = 'mutation' |> require('debug')('auth').extend

export const me = ~({})
export const authenticate = ~({})

export const refreshMe = async (_, __, { getUser, env, userOps: { loadAccessToken, loadSession, getSessionByHash }, eventOps: { sendAccessToken, parseUserAgent, parseRefreshToken } }) => {
	debug('asking for an accessToken')
	const user = (await getUser(true)) |> loadSession(env.IP, parseUserAgent())
	const sess = user |> getSessionByHash(user[Symbol.transient].sessionHash)
	if (sess.refreshToken !== parseRefreshToken()) throw new InvalidRefreshTokenError()
	user |> loadAccessToken(env)
	sendAccessToken(user[Symbol.transient].accessToken, true)
	return `And you're full of gas!`
}

export const signout = async (_, __, { eventOps: { removeCookies }, getUser, userIops: { push }, userOps: { deleteSessionByHash } }) => {
	debug('loging out..')
	const user = await getUser(true)
	debug('deleting session..')
	user |> deleteSessionByHash(user[Symbol.transient].session.hash)
	debug('saving user')
	await push(user)
	debug('removing cookies..')
	removeCookies()
	return "Bye."
}