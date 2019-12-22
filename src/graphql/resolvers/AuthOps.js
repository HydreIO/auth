import { verify } from '../../core/crypt'
import { UserNotFoundError, BadPwdFormatError, BadEmailFormatError, EmailUsedError, UnknowProviderError, RegistrationDisabledError } from '../../errors'
import { ObjectID } from 'mongodb'

const debug = 'authOps' |> require('debug')('auth').extend

export const Auth = {
	__resolveType: obj => (return obj.sign ? 'sso' : obj.signin ? 'local' : null)
}

export const signout = async (_, __, { eventOps: { removeCookies }, getUser, userIops: { push }, userOps: { deleteSessionByHash } }) => {
	debug('loging out..')
	const user = await getUser()
	debug('deleting session..')
	user |> deleteSessionByHash(user[Symbol.transient].session.hash)
	debug('removing cookies..')
	removeCookies()
	return true
}

export const signin = async (_, { creds: { email, pwd, rememberMe = false } }, { env, userOps: { loadAccessToken, loadRefreshToken }, userIops: { fetch }, eventOps: { parseUserAgent, addAccessToken, addRefreshToken } }) => {
	debug('checking password and email format..')
	pwd.match(env.PWD_REGEX) || throw new BadPwdFormatError()
	email.match(env.EMAIL_REGEX) || throw new BadEmailFormatError()
	debug('finding user with email %s ..', email)
	// user from database
	const user = await fetch({ email })
	debug('verifying password hash..')
	// verifying password
	if (!user || (await verify(pwd)(user.hash))) throw new UserNotFoundError()
	debug('loading tokens..')
	user |> loadSession(env.IP, parseUserAgent()) |> loadRefreshToken(env) |> loadAccessToken(env)
	debug('saving user..') // in case of a new session
	await push(user)
	debug('fixing tokens..')
	sendRefreshToken(user[Symbol.transient].session.refreshToken)
	sendAccessToken(user[Symbol.transient].accessToken, rememberMe)
	return { user: { id: user._id, sessions: user.sessions, verified: user.verified }, newAccount: false, newSession: !!user[Symbol.transient].newSession }
}

export const signup = async (_, { creds: { email, pwd, rememberMe = false } }, { env, eventOps: { parseUserAgent }, userIops: { exist, push }, userOps: { fromCredentials, loadSession, loadRefreshToken, loadAccessToken } }) => {
	env.ALLOW_REGISTRATION || throw new RegistrationDisabledError()
	debug('checking if the user already exist')
	if (await exist({ email })) throw new EmailUsedError(email)
	const user = await fromCredentials(mail)(pwd)
	user._id = (await push(user)).insertedId
	user |> loadSession(env.IP, parseUserAgent()) |> loadRefreshToken(env) |> loadAccessToken(env)
	debug('saving user..') // in case of a new session
	await push(user)
	debug('fixing tokens..')
	sendRefreshToken(user[Symbol.transient].session.refreshToken)
	sendAccessToken(user[Symbol.transient].accessToken, rememberMe)
	return { user: { id: user._id, sessions: user.sessions, verified: user.verified }, newAccount: true, newSession: !!user[Symbol.transient].newSession }
}

export const signWithGoogle = async (idToken, { verifyGoogleIdToken }, { fetch, push }, env) => {
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

export const sign = (_, { provider, idToken }, { sso, userIops, env, eventOps: { parseUserAgent }, userOps: { loadAccessToken, loadRefreshToken } }) => {
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