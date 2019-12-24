import { verify } from '../../core/crypt'
import { UserNotFoundError, BadPwdFormatError, BadEmailFormatError, EmailUsedError, RegistrationDisabledError } from '../errors'

const debug = require('debug')('auth').extend('local')

export const signin = async (_, { creds: { email, pwd, rememberMe = false } }, { env, userOps: { loadSession, loadAccessToken, loadRefreshToken }, userIops: { fetch, push }, eventOps: { parseUserAgent, addAccessToken, addRefreshToken, sendRefreshToken, sendAccessToken } }) => {
	debug('checking password and email format..')
	pwd.match(env.PWD_REGEX) || throw new BadPwdFormatError()
	email.match(env.EMAIL_REGEX) || throw new BadEmailFormatError()
	debug('finding user with email %s ..', email)
	// user from database
	const user = await fetch({ email })
	debug('verifying password hash..')
	// verifying password
	if (!user || !(await verify(pwd)(user.hash))) throw new UserNotFoundError()
	debug('loading tokens..')
	user |> loadSession(env.IP, parseUserAgent()) |> loadRefreshToken(env) |> loadAccessToken(env)
	debug('saving user..') // in case of a new session
	await push(user)
	debug('fixing tokens..')
	sendRefreshToken(user[Symbol.transient].session.refreshToken)
	sendAccessToken(user[Symbol.transient].accessToken, rememberMe)
	return { user: { id: user._id, sessions: user.sessions, verified: user.verified }, newAccount: false, newSession: !!user[Symbol.transient].newSession }
}

export const signup = async (_, { creds: { email, pwd, rememberMe = false } }, { env, eventOps: { parseUserAgent, sendAccessToken, sendRefreshToken }, userIops: { exist, push }, userOps: { fromCredentials, loadSession, loadRefreshToken, loadAccessToken } }) => {
	env.ALLOW_REGISTRATION || throw new RegistrationDisabledError()
	debug('checking if the user already exist..')
	if (await exist({ email })) throw new EmailUsedError(email)
	debug('initialising user')
	const user = await fromCredentials(email)(pwd)
	debug('saving user to create his id..')
	user._id = (await push(user)).upsertedId._id.toString()
	debug('loading tokens..')
	user |> loadSession(env.IP, parseUserAgent()) |> loadRefreshToken(env) |> loadAccessToken(env)
	debug('saving user again..') // in case of a new session
	await push(user)
	debug('fixing tokens..')
	sendRefreshToken(user[Symbol.transient].session.refreshToken)
	sendAccessToken(user[Symbol.transient].accessToken, rememberMe)
	return { user: { id: user._id, sessions: user.sessions, verified: user.verified }, newAccount: true, newSession: !!user[Symbol.transient].newSession }
}