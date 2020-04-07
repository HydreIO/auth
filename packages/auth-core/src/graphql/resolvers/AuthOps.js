import { verify } from '../../core/utils/crypt'
import { UserNotFoundError, BadPwdFormatError, BadMailFormatError, MailUsedError, RegistrationDisabledError, UnknowProviderError } from '../errors'
import uuid from 'uuid'
import Debug from 'debug'

const { v4: uuidv4 } = uuid
const debug = Debug('auth').extend('authenticate')

export const signup = async (_, { creds: { mail, pwd, rememberMe = false } }, { env, eventOps: { parseUserAgent, sendAccessToken, sendRefreshToken }, crud: { existByMail, pushByUid }, userOps: { fromCredentials, loadSession, loadRefreshToken, loadAccessToken } }) => {
	if (!env.ALLOW_REGISTRATION) throw new RegistrationDisabledError()
	debug('.......checking password and mail format')
	if (!pwd.match(env.PWD_REGEX)) throw new BadPwdFormatError()
	if (!mail.match(env.EMAIL_REGEX)) throw new BadMailFormatError()
	debug('.......checking if the user already exist')
	if (await existByMail(mail)) throw new MailUsedError(mail)
	debug('.......initialising user')
	const user = await fromCredentials(mail)(pwd)
	debug('.......generating uuid')
	user.uuid = uuidv4()
	debug.extend('uuid')(user.uuid)
	debug('.......loading tokens')
	loadAccessToken(env)(loadRefreshToken(env)(loadSession(env.IP, parseUserAgent())(user)))
	debug('.......saving user')
	await pushByUid(user.uuid, user)
	debug('.......fixing tokens')
	sendRefreshToken(user[Symbol.transient].session.refreshToken)
	sendAccessToken(user[Symbol.transient].accessToken, rememberMe)
	const { uuid, sessions, verified } = user
	return { user: { uuid, mail, sessions, verified }, newAccount: true, newSession: !!user[Symbol.transient].newSession }
}

export const signin = async (_, { creds: { mail, pwd, rememberMe = false } }, { env, userOps: { loadSession, loadAccessToken, loadRefreshToken }, crud: { fetchByMail, pushByUid }, eventOps: { parseUserAgent, addAccessToken, addRefreshToken, sendRefreshToken, sendAccessToken } }) => {
	debug('.......checking password and mail format')
	if (!pwd.match(env.PWD_REGEX)) throw new BadPwdFormatError()
	if (!mail.match(env.EMAIL_REGEX)) throw new BadMailFormatError()
	debug('.......finding user matching %s', mail)
	// user from database
	const user = await fetchByMail(mail)
	debug('.......verifying user and password hash')
	// verifying password
	if (!user || !(await verify(pwd)(user.hash))) throw new UserNotFoundError()
	debug('.......loading tokens')
	loadAccessToken(env)(loadRefreshToken(env)(loadSession(env.IP, parseUserAgent())(user)))
	if (user[Symbol.transient].newSession) {
		debug('.......new session detected, saving user')
		await pushByUid(user.uuid, user)
	}
	debug('.......fixing tokens')
	sendRefreshToken(user[Symbol.transient].session.refreshToken)
	sendAccessToken(user[Symbol.transient].accessToken, rememberMe)
	const { uuid, sessions, verified } = user
	return { user: { uuid, mail, sessions, verified }, newAccount: false, newSession: !!user[Symbol.transient].newSession }
}

const signWithGoogle = async (idToken, { verifyGoogleIdToken }, { fetchByMail, pushByUid }, env) => {
	debug('.......verifying google id_token')
	const { userid, mail } = await verifyGoogleIdToken(idToken)
	debug('.......finding user with google id %s', userid)
	const user = (await fetchByMail(mail)) || { mail, [Symbol.transient]: { newAccount: true } }
	if (user[Symbol.transient]?.newAccount) {
		debug(`.......user doesn't exist yet`)
		if (!env.ALLOW_REGISTRATION) throw new RegistrationDisabledError()
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
			break
		default:
			throw new UnknowProviderError()
	}
	loadAccessToken(env)(loadRefreshToken(env)(loadSession(env.IP, parseUserAgent())(user)))
	if (user[Symbol.transient].newSession) {
		debug('.......new session detected, saving user')
		await pushByUid(user.uuid, user)
	}
	debug('......fixing tokens')
	sendRefreshToken(user[Symbol.transient].session.refreshToken)
	sendAccessToken(user[Symbol.transient].accessToken, true)
	const { uuid, mail, sessions, verified } = user
	return { user: { uuid, mail, sessions, verified }, newAccount: !!user[Symbol.transient].newAccount, newSession: !!user[Symbol.transient].newSession }
}

export const signout = async (_, __, { eventOps: { removeCookies }, getUser, crud: { pushByUid }, userOps: { deleteSessionByHash } }) => {
	debug('......loging out')
	try {
		const user = await getUser({ canAccessTokenBeExpired: true, checkForCurrentSessionChanges: false })
		debug('......deleting session')
		deleteSessionByHash(user[Symbol.transient].session.hash)(user)
		debug('......saving user')
		await pushByUid(user.uuid, user)
	} catch {
		debug('......user not found, skipping session deletion')
	}
	debug('......removing cookies')
	removeCookies()
	return "Bye."
}