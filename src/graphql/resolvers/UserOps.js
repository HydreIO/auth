import { signJwt, buildJwtOptions } from '../../core/tokens'
import { ObjectID } from 'mongodb'
import crypto from 'crypto'
import { publishToSNS } from '../../core/sns'
import { hash } from '../../core/crypt'
import { TooManyResetRequestError, UnknowCodeError, BadPwdFormatError, InvalidResetCodeError, InvalidVerificationCodeError } from '../errors'

const debug = 'userOps' |> require('debug')('auth').extend

const shaCode = email => crypto.createHash('sha256').update(`${email}${crypto.randomBytes(32).toString('hex')}`).digest('hex'))

export const sendCode = async (_, { code, email }, { env: { LABEL, RESET_PASS_DELAY }, userIops: { push, fetch } }) => {
	debug('asking code')
	const user = await fetch({ email })
	// we don't want our api to notify anything in case the email is not associated
	// with an account, so we act like nothing hapenned in case there is no user
	if (!user) return
	debug('User with email %s was found', email)
	switch (code) {
		case 'RESET_PWD':
			// allowing this query only once every X ms
			if (user.lastResetEmailSent + RESET_PASS_DELAY > Date.now()) throw new TooManyResetRequestError()
			// if the code already exist we retrieve it, if not we create a new one
			user.resetCode ||= shaCode(email)
			user.lastResetEmailSent = Date.now()
			debug('emailing code')
			await publishToSNS(`${LABEL}:auth:reset_pass`)(JSON.stringify({ to: email, code: user.resetCode }))
			debug('updating user')
			await push(user)
			break
		case 'CONFIRM_EMAIL':
			// if the code already exist we retrieve it, if not we create a new one
			user.verificationCode ||= shaCode(email)
			await publishToSNS(`${LABEL}:auth:confirm_mail`)(JSON.stringify({ to: email, code: user.confirmCode }))
			await push(user)
			break
		default: throw new UnknowCodeError()
	}
}

export const resetPassword = async (_, { email, newPwd, resetCode }, { userIops: { fetch, push }, env: { PWD_REGEX } }) => {
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
}

export const confirmEmail = async (_, { code }, { getUser }) => {
	const user = await getUser()
	if (!user.verificationCode || user.verificationCode !== code) throw new InvalidVerificationCodeError()
	user.verificationCode = ''
	user.verified = true
	await push(user)
}

export const inviteUser = async (_, { email }, { getUser, userIops: { fetch, push }, env: { PRV_KEY, LABEL } }) => {
	debug('inviting user %s', email)
	const user = await getUser()
	if (await fetch({ email })) return // no need to invite if it already exist

	const resetCode = crypto.createHash('sha256').update(`${email}${crypto.randomBytes(32).toString('hex')}`).digest('hex')
	const invited = { email, hash: undefined, sessions: [], resetCode }
	const jwtOptions = buildJwtOptions('auth::service')(user._id.toString())(user[Symbol.transient].sessionHash)('20s')

	// notify SNS
	await publishToSNS(`${LABEL}:auth:invite_user`)(JSON.stringify({ to: email, code: resetCode }))
	return signJwt(PRV_KEY)(jwtOptions)({ invitedId: (await insertUser(invited)).insertedId.toString(), email })
}