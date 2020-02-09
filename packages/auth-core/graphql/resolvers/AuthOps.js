import { verify } from '../../core/utils/crypt'
import { UserNotFoundError, BadPwdFormatError, BadEmailFormatError, EmailUsedError, RegistrationDisabledError, UnknowProviderError } from '../errors'
import uuidv4 from 'uuid/v4'

const debug = require('debug')('internal').extend('authenticate')

export const signup = async (_, { creds: { email, pwd, rememberMe = false } }, { env, eventOps: { parseUserAgent, sendAccessToken, sendRefreshToken }, crud: { exist, push }, userOps: { fromCredentials, loadSession, loadRefreshToken, loadAccessToken } }) => {
	env.ALLOW_REGISTRATION || throw new RegistrationDisabledError()
	debug('.......checking password and email format')
	pwd.match(env.PWD_REGEX) || throw new BadPwdFormatError()
	email.match(env.EMAIL_REGEX) || throw new BadEmailFormatError()
	debug('.......checking if the user already exist')
	if (await exist({ email })) throw new EmailUsedError(email)
	debug('.......initialising user')
	const user = await fromCredentials(email)(pwd)
	debug('.......generating uuid')
	user.uuid = uuidv4()
	debug.extend('uuid')(user.uuid)
	debug('.......loading tokens')
	user |> loadSession(env.IP, parseUserAgent()) |> loadRefreshToken(env) |> loadAccessToken(env)
	debug('.......saving user')
	await push(user.uuid, user)
	debug('.......fixing tokens')
	sendRefreshToken(user[Symbol.transient].session.refreshToken)
	sendAccessToken(user[Symbol.transient].accessToken, rememberMe)
	const { uuid, sessions, verified } = user
	return { user: { uuid, email, sessions, verified }, newAccount: true, newSession: !!user[Symbol.transient].newSession }
}

export const signin = async (_, { creds: { email, pwd, rememberMe = false } }, { env, userOps: { loadSession, loadAccessToken, loadRefreshToken }, crud: { fetch, push }, eventOps: { parseUserAgent, addAccessToken, addRefreshToken, sendRefreshToken, sendAccessToken } }) => {
	debug('.......checking password and email format')
	pwd.match(env.PWD_REGEX) || throw new BadPwdFormatError()
	email.match(env.EMAIL_REGEX) || throw new BadEmailFormatError()
	debug('.......finding user matching %s', email)
	// user from database
	const user = await fetch({ email })
	debug('.......verifying password hash')
	// verifying password
	if (!user || !(await verify(pwd)(user.hash))) throw new UserNotFoundError()
	debug('.......loading tokens')
	user |> loadSession(env.IP, parseUserAgent()) |> loadRefreshToken(env) |> loadAccessToken(env)
	if (user[Symbol.transient].newSession) {
		debug('.......new session detected, saving user')
		await push(user.uuid, user)
	}
	debug('.......fixing tokens')
	sendRefreshToken(user[Symbol.transient].session.refreshToken)
	sendAccessToken(user[Symbol.transient].accessToken, rememberMe)
	const { uuid, sessions, verified } = user
	return { user: { uuid, email, sessions, verified }, newAccount: false, newSession: !!user[Symbol.transient].newSession }
}

const signWithGoogle = async (idToken, { verifyGoogleIdToken }, { fetch, push }, env) => {
	debug('.......verifying google id_token')
	const { userid, email } = await verifyGoogleIdToken(idToken)
	debug('.......finding user with google id %s', userid)
	const userDatas = { sso: { google: userid } }
	const user = (await fetch(userDatas)) || { [Symbol.transient]: { newAccount: true } }
	if (user[Symbol.transient]?.newAccount) {
		debug(`.......user doesn't exist yet`)
		env.ALLOW_REGISTRATION || throw new RegistrationDisabledError()
		Object.assign(user, { email, ...userDatas })
		debug('.......generating uuid')
		user.uuid = uuidv4()
		debug.extend('uuid')(user.uuid)
	}
	debug('.......user datas loaded')
	return user
}

export const sign = async (_, { provider, idToken }, { sso, crud, env, eventOps: { sendRefreshToken, sendAccessToken, parseUserAgent }, userOps: { loadSession, loadAccessToken, loadRefreshToken } }) => {
	const user = {}
	switch (provider) {
		case "GOOGLE":
			Object.assign(user, await signWithGoogle(idToken, sso, crud, env))
			break;
		default:
			throw new UnknowProviderError()
	}
	user |> loadSession(env.IP, parseUserAgent()) |> loadRefreshToken(env) |> loadAccessToken(env)
	if (user[Symbol.transient].newSession) {
		debug('.......new session detected, saving user')
		await push(user.uuid, user)
	}
	debug('......fixing tokens')
	sendRefreshToken(user[Symbol.transient].session.refreshToken)
	sendAccessToken(user[Symbol.transient].accessToken, true)
	const { uuid, email, sessions, verified } = user
	return { user: { uuid, email, sessions, verified }, newAccount: !!user[Symbol.transient].newAccount, newSession: !!user[Symbol.transient].newSession }
}

export const signout = async (_, __, { eventOps: { removeCookies }, getUser, crud: { push }, userOps: { deleteSessionByHash } }) => {
	debug('......loging out')
	const user = await getUser({ canAccessTokenBeExpired: true, checkForCurrentSessionChanges: false })
	debug('......deleting session')
	user |> deleteSessionByHash(user[Symbol.transient].session.hash)
	debug('......saving user')
	await push(user.uuid, user)
	debug('......removing cookies')
	removeCookies()
	return "Bye."
}