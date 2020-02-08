import { signJwt, buildJwtOptions } from '../../core/tokens'
import crypto from 'crypto'
import events from '../../core/utils/events'
import { EVENTS } from '../../core/utils/constant'
import { hash } from '../../core/utils/crypt'
import { TooManyCodeRequestError, BadEmailFormatError, UnknowCodeError, BadPwdFormatError, InvalidResetCodeError, InvalidVerificationCodeError, InvalidRefreshTokenError } from '../errors'

const debug = 'me' |> require('debug')('internal').extend

const shaCode = email => crypto.createHash('sha256').update(`${email}${crypto.randomBytes(32).toString('hex')}`).digest('hex')

export const refresh = async (_, __, { getUser, env, userOps: { loadAccessToken, loadSession, getSessionByHash }, eventOps: { sendAccessToken, parseUserAgent, parseRefreshToken } }) => {
	debug('asking for an accessToken')
	const user = (await getUser(true)) |> loadSession(env.IP, parseUserAgent())
	const sess = user |> getSessionByHash(user[Symbol.transient].sessionHash)
	if (sess.refreshToken !== parseRefreshToken()) throw new InvalidRefreshTokenError()
	user |> loadAccessToken(env)
	sendAccessToken(user[Symbol.transient].accessToken, true)
	return `And you're full of gas!`
}

export const confirmEmail = async (_, { email, code }, { getUser, env, crud: { fetch, push } }) => {
	email.match(env.EMAIL_REGEX) || throw new BadEmailFormatError()
	const user = await fetch({ email })
	if (user) { // we don't notify the client if there is no user
		debug('User with email %s was found', email)
		if (!user.verificationCode || user.verificationCode !== code) throw new InvalidVerificationCodeError()
		user.verificationCode = ''
		user.verified = true
		await push(user)
	}
	return `You're one with the force`
}

export const inviteUser = async (_, { email }, { getUser, crud: { fetch, push }, env: { PRV_KEY, LABEL, EMAIL_REGEX } }) => {
	debug('inviting user %s', email)
	email.match(EMAIL_REGEX) || throw new BadEmailFormatError()
	const user = await getUser()
	if (await fetch({ email })) return // no need to invite if it already exist
	debug('creating reset code')
	const resetCode = crypto.createHash('sha256').update(`${email}${crypto.randomBytes(32).toString('hex')}`).digest('hex')
	const invited = { email, hash: undefined, sessions: [], resetCode }
	const jwtOptions = buildJwtOptions('auth::service')(user._id)(user[Symbol.transient].sessionHash)('20s')
	events.emit(EVENTS.INVITE_USER, { to: email, code: resetCode })
	debug('signing jwt')
	return signJwt(PRV_KEY)(jwtOptions)({ invitedId: (await push(invited)).upsertedId._id.toString(), email })
}

export const sendCode = async (_, { code, email }, { env: { LABEL, RESET_PASS_DELAY, CONFIRM_ACCOUNT_DELAY, EMAIL_REGEX }, crud: { push, fetch } }) => {
	debug('asking code')
	email.match(EMAIL_REGEX) || throw new BadEmailFormatError()
	const user = await fetch({ email })
	// we don't want our api to notify anything in case the email is not associated
	// with an account, so we act like nothing hapenned in case there is no user
	if (user) {
		debug('User with email %s was found', email)
		switch (code) {
			case 'RESET_PWD':
				// allowing this query only once every X ms
				if (user.lastResetEmailSent + RESET_PASS_DELAY > Date.now()) throw new TooManyCodeRequestError()
				// if the code already exist we retrieve it, if not we create a new one
				user.resetCode ||= shaCode(email)
				user.lastResetEmailSent = Date.now()
				debug('emailing reset code')
				events.emit(EVENTS.RESET_PWD, { to: email, code: user.resetCode })
				debug('updating user')
				await push(user)
				break
			case 'CONFIRM_EMAIL':
				// allowing this query only once every X ms
				if (user.lastVerifEmailSent + CONFIRM_ACCOUNT_DELAY > Date.now()) throw new TooManyCodeRequestError()
				// if the code already exist we retrieve it, if not we create a new one
				user.verificationCode ||= shaCode(email)
				user.lastVerifEmailSent = Date.now()
				debug('emailing confirm code')
				events.emit(EVENTS.CONFIRM_EMAIL, { to: email, code: user.confirmCode })
				debug('updating user')
				await push(user)
				break
			default: throw new UnknowCodeError()
		}
	}
	return 'Bip bop! code sent (or not)'
}

export const resetPassword = async (_, { email, newPwd, resetCode }, { crud: { fetch, push }, env: { PWD_REGEX, EMAIL_REGEX } }) => {
	email.match(EMAIL_REGEX) || throw new BadEmailFormatError()
	const user = await fetch({ email })
	debug('asking pwd reset')
	if (user) {
		debug('user found, checking password format')
		newPwd.match(PWD_REGEX) || throw new BadPwdFormatError()
		if (!user.resetCode || user.resetCode !== resetCode) throw new InvalidResetCodeError()
		user.hash = await hash(newPwd)
		user.resetCode = ''
		debug('upserting user')
		await push(user)
	}
	return 'A fresh new start!'
}