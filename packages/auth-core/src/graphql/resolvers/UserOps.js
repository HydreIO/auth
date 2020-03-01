import { signJwt, buildJwtOptions } from '../../core/tokens'
import crypto from 'crypto'
import events from '../../core/utils/events'
import { EVENTS } from '../../core/utils/constant'
import { hash } from '../../core/utils/crypt'
import { TooManyRequestError, BadMailFormatError, UnknowCodeError, BadPwdFormatError, InvalidResetCodeError, InvalidVerificationCodeError, InvalidRefreshTokenError } from '../errors'
import uuidv4 from 'uuid/v4'
import Debug from 'debug'

const debug = Debug('internal').extend('me')

const shaCode = mail => crypto.createHash('sha256').update(`${mail}${crypto.randomBytes(32).toString('hex')}`).digest('hex')

export const refresh = async (_, __, { getUser, env, userOps: { loadAccessToken, loadSession, getSessionByHash }, eventOps: { sendAccessToken, parseUserAgent, parseRefreshToken } }) => {
	debug('......asking for an accessToken')
	const user = loadSession(env.IP, parseUserAgent())((await getUser({ canAccessTokenBeExpired: true })))
	const sess = getSessionByHash(user[Symbol.transient].sessionHash)(user)
	if (sess.refreshToken !== parseRefreshToken()) throw new InvalidRefreshTokenError()
	loadAccessToken(env)(user)
	sendAccessToken(user[Symbol.transient].accessToken, true)
	return `And you're full of gas!`
}

export const confirmMail = async (_, { mail, code }, { getUser, env, crud: { fetchByMail, pushByUid } }) => {
	if (!mail.match(env.EMAIL_REGEX)) throw new BadMailFormatError()
	const user = await fetchByMail(mail)
	if (user) { // we don't notify the client if there is no user
		debug('......User with mail %s was found', mail)
		if (!user.verificationCode || user.verificationCode !== code) throw new InvalidVerificationCodeError()
		user.verificationCode = ''
		user.verified = true
		await pushByUid(user.uuid, user)
	}
	return `You're one with the force`
}

export const inviteUser = async (_, { mail }, { getUser, crud: { existByMail, pushByUid }, env: { PRV_KEY, LABEL, EMAIL_REGEX, INVITE_USER_DELAY } }) => {
	debug('......inviting user %s', mail)
	if (!mail.match(EMAIL_REGEX)) throw new BadMailFormatError()
	const user = await getUser()
	// allowing this query only once every X ms
	if (user.lastInvitationSent + INVITE_USER_DELAY > Date.now()) throw new TooManyRequestError()
	user.lastInvitationSent = Date.now()
	// updating user to prevent query spaming
	await pushByUid(user.uuid, user)
	// no need to invite if it already exist
	if (await existByMail(mail)) return
	debug('......creating reset code')
	const resetCode = crypto.createHash('sha256').update(`${mail}${crypto.randomBytes(32).toString('hex')}`).digest('hex')
	const invited = { uuid: uuidv4(), mail, hash: undefined, sessions: [], resetCode }
	debug('......presaving invited user')
	await pushByUid(invited.uuid, invited)
	const jwtOptions = buildJwtOptions('auth::service')(user.uuid)(user[Symbol.transient].sessionHash)('20s')
	events.emit(EVENTS.INVITE_USER, { to: mail, code: resetCode })
	debug('......signing jwt')
	return signJwt(PRV_KEY)(jwtOptions)({ uuid: invited.uuid, mail })
}

export const sendCode = async (_, { code, mail }, { env: { LABEL, RESET_PASS_DELAY, CONFIRM_ACCOUNT_DELAY, EMAIL_REGEX }, crud: { pushByUid, fetchByMail } }) => {
	debug('......asking code')
	if (!mail.match(EMAIL_REGEX)) throw new BadMailFormatError()
	const user = await fetchByMail(mail)
	// we don't want our api to notify anything in case the mail is not associated
	// with an account, so we act like nothing hapenned in case there is no user
	if (user) {
		debug('......user with mail %s was found', mail)
		switch (code) {
			case 'RESET_PWD':
				// allowing this query only once every X ms
				if (user.lastResetMailSent + RESET_PASS_DELAY > Date.now()) throw new TooManyRequestError()
				// if the code already exist we retrieve it, if not we create a new one
				if (!user.resetCode) user.resetCode = shaCode(mail)
				user.lastResetMailSent = Date.now()
				debug('......mailing reset code')
				events.emit(EVENTS.RESET_PWD, { to: mail, code: user.resetCode })
				debug('......updating user')
				await pushByUid(user.uuid, user)
				break
			case 'CONFIRM_EMAIL':
				// allowing this query only once every X ms
				if (user.verified) return `You're verified already billy!`
				if (user.lastVerifMailSent + CONFIRM_ACCOUNT_DELAY > Date.now()) throw new TooManyRequestError()
				// if the code already exist we retrieve it, if not we create a new one
				if (!user.verificationCode) user.verificationCode = shaCode(mail)
				user.lastVerifMailSent = Date.now()
				debug('......mailing confirm code')
				events.emit(EVENTS.CONFIRM_EMAIL, { to: mail, code: user.verificationCode })
				debug('......updating user')
				await pushByUid(user.uuid, user)
				break
			default: throw new UnknowCodeError()
		}
	}
	return 'Bip bop! code sent (or not)'
}

export const resetPassword = async (_, { mail, newPwd, resetCode }, { crud: { fetchByMail, pushByUid }, env: { PWD_REGEX, EMAIL_REGEX } }) => {
	if (!mail.match(EMAIL_REGEX)) throw new BadMailFormatError()
	const user = await fetchByMail(mail)
	debug('......asking pwd reset')
	if (user) {
		debug('......user found, checking password format')
		if (!newPwd.match(PWD_REGEX)) throw new BadPwdFormatError()
		if (!user.resetCode || user.resetCode !== resetCode) throw new InvalidResetCodeError()
		user.hash = await hash(newPwd)
		user.resetCode = ''
		debug('......upserting user')
		await pushByUid(user.uuid, user)
	}
	return 'A fresh new start!'
}