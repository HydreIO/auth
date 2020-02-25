import PrettyError from 'pretty-error'
import Debug from 'debug'

const CODES = {
	EMAIL_USED: 'EMAIL_USED',
	USER_INCORRECT: 'USER_INCORRECT',
	UNKNOW_PROVIDER: 'UNKNOW_PROVIDER',
	PWD_FORMAT: 'PWD_FORMAT',
	EMAIL_FORMAT: 'EMAIL_FORMAT',
	REGISTRATION_DISABLED: 'REGISTRATION_DISABLED',
	SESSION: 'SESSION',
	USER_AGENT: 'USER_AGENT',
	COOKIES: 'COOKIES',
	HEADERS: 'HEADERS',
	REFRESH_TOKEN: 'REFRESH_TOKEN',
	ACCESS_TOKEN: 'ACCESS_TOKEN',
	SPAM: 'SPAM',
	RESET_CODE_INVALID: 'RESET_CODE_INVALID',
	VERIFICATION_CODE_INVALID: 'VERIFICATION_CODE_INVALID',
	GOOGLE_ID: 'GOOGLE_ID',
	GOOGLE_EMAIL_NOT_GRANTED: 'GOOGLE_EMAIL_NOT_GRANTED',
	GOOGLE_TOKEN: 'GOOGLE_TOKEN',
	UNKNOW_CODE: 'UNKNOW_CODE'
}

const prettyError = new PrettyError()
const debug = Debug('auth')

export const formatError = error => {
	let { message, extensions: { code: type } } = error
	if (type === 'INTERNAL_SERVER_ERROR') {
		console.error(prettyError.render({ ...error, stack: error.extensions?.exception?.stacktrace?.join('\n') }))
		message = 'Oops.. something went wrong! Contact us if this error persist !'
	}
	return { message, type }
}

export class BaseError extends Error {
	constructor(msg, type) {
		super(msg)
		Object.assign(this, { message: msg, extensions: { code: type } })
	}
}

export class UnknowCodeError extends BaseError {
	constructor() {
		super(`This code doesn't exist`, CODES.UNKNOW_CODE)
	}
}

export class InvalidVerificationCodeError extends BaseError {
	constructor() {
		super(`This code doesn't exist`, CODES.VERIFICATION_CODE_INVALID)
	}
}

export class GoogleTokenError extends BaseError {
	constructor() {
		super(`Google idToken invalid`, CODES.GOOGLE_TOKEN)
	}
}

export class GoogleIdNotFoundError extends BaseError {
	constructor() {
		super(`Google user id not found`, CODES.GOOGLE_ID)
	}
}

export class GoogleMailNotFoundError extends BaseError {
	constructor() {
		super(`Google user mail not found, app need to grant access in request`, CODES.GOOGLE_EMAIL_NOT_GRANTED)
	}
}

export class InvalidResetCodeError extends BaseError {
	constructor() {
		super(`The reset code is invalid`, CODES.RESET_CODE_INVALID)
	}
}

export class TooManyRequestError extends BaseError {
	constructor() {
		super(`This request is protected against spam`, CODES.SPAM)
	}
}
export class InvalidAccessTokenError extends BaseError {
	constructor() {
		super(`The access token is invalid or expired`, CODES.ACCESS_TOKEN)
	}
}

export class InvalidRefreshTokenError extends BaseError {
	constructor() {
		super(`The refresh token is invalid`, CODES.REFRESH_TOKEN)
	}
}

export class HeadersError extends BaseError {
	constructor() {
		super(`Headers are invalid or missing`, CODES.HEADERS)
	}
}

export class CookiesError extends BaseError {
	constructor() {
		super(`Cookies are invalid or missing`, CODES.COOKIES)
	}
}

export class UserAgentError extends BaseError {
	constructor() {
		super(`The user agent is invalid`, CODES.USER_AGENT)
	}
}

export class SessionError extends BaseError {
	constructor() {
		super(`The session doesn't exist, is expired, or was revoked`, CODES.SESSION)
	}
}

export class CSRFError extends BaseError {
	constructor() {
		super('Invalid or missing csrf token in request', CODES.CSRF)
	}
}

export class MailUsedError extends BaseError {
	constructor(mail) {
		super(`The mail address ${mail} is already in use.`, CODES.EMAIL_USED)
	}
}

export class UserNotFoundError extends BaseError {
	constructor() {
		super('User not found', CODES.USER_INCORRECT)
	}
}

export class UnknowProviderError extends BaseError {
	constructor(provider) {
		super(`The provider ${provider} is not implemented`, CODES.UNKNOW_PROVIDER)
	}
}

export class BadPwdFormatError extends BaseError {
	constructor() {
		super('Incorrect password format', CODES.PWD_FORMAT)
	}
}

export class BadMailFormatError extends BaseError {
	constructor() {
		super('Incorrect mail format', CODES.EMAIL_FORMAT)
	}
}

export class RegistrationDisabledError extends BaseError {
	constructor() {
		super('Registrations are currently disabled', CODES.REGISTRATION_DISABLED)
	}
}
