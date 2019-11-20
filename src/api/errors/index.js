import { ApolloError } from 'apollo-server-lambda'

const CODES = {
	EMAIL_USED: 'EMAIL_USED',
	USER_INCORRECT: 'USER_INCORRECT',
	UNKNOW_PROVIDER: 'UNKNOW_PROVIDER',
	PWD_FORMAT: 'PWD_FORMAT',
	EMAIL_FORMAT: 'EMAIL_FORMAT',
	REGISTRATION_DISABLED: 'REGISTRATION_DISABLED',
	CSRF_INVALID: 'CSRF_INVALID',
	SESSION: 'SESSION',
	USER_AGENT: 'USER_AGENT',
	COOKIES: 'COOKIES',
	HEADERS: 'HEADERS',
	REFRESH_TOKEN: 'REFRESH_TOKEN',
	ACCESS_TOKEN: 'ACCESS_TOKEN',
	WAIT_RESET_CODE: 'WAIT_RESET_CODE',
	RESET_CODE_MISSING: 'RESET_CODE_MISSING',
	RESET_CODE_INVALID: 'RESET_CODE_INVALID',
	GOOGLE_ID: 'GOOGLE_ID',
	GOOGLE_EMAIL_NOT_GRANTED: 'GOOGLE_EMAIL_NOT_GRANTED'
}
export class GoogleIdNotFound extends ApolloError {
	constructor() {
		super(`Google user id not found`, CODES.GOOGLE_ID)
	}
}
export class GoogleEmailNotFound extends ApolloError {
	constructor() {
		super(`Google user email not found, app need to grant access in request`, CODES.GOOGLE_EMAIL_NOT_GRANTED)
	}
}

export class InvalidResetCodeError extends ApolloError {
	constructor() {
		super(`The reset code is invalid`, CODES.RESET_CODE_INVALID)
	}
}

export class ResetCodeNotFoundError extends ApolloError {
	constructor() {
		super(`The user doesn't have any resetcode available`, CODES.RESET_CODE_MISSING)
	}
}

export class TooManyResetRequestError extends ApolloError {
	constructor() {
		super(`A reset code can't be sent again that quickly`, CODES.WAIT_RESET_CODE)
	}
}
export class InvalidAccessTokenError extends ApolloError {
	constructor() {
		super(`The access token is invalid or expired`, CODES.ACCESS_TOKEN)
	}
}

export class InvalidRefreshTokenError extends ApolloError {
	constructor() {
		super(`The refresh token is invalid`, CODES.REFRESH_TOKEN)
	}
}

export class HeadersError extends ApolloError {
	constructor() {
		super(`Headers are invalid or missing`, CODES.HEADERS)
	}
}

export class CookiesError extends ApolloError {
	constructor() {
		super(`Cookies are invalid or missing`, CODES.COOKIES)
	}
}

export class UserAgentError extends ApolloError {
	constructor() {
		super(`The user agent is invalid`, CODES.USER_AGENT)
	}
}

export class SessionError extends ApolloError {
	constructor() {
		super(`The session doesn't exist or was revoked`, CODES.SESSION)
	}
}

export class CSRFError extends ApolloError {
	constructor() {
		super('Invalid or missing csrf token in request', CODES.CSRF)
	}
}

export class EmailUsedError extends ApolloError {
	constructor(email) {
		super(`The email address ${email} is already in use.`, CODES.EMAIL_USED)
	}
}

export class UserNotFoundError extends ApolloError {
	constructor() {
		super('User not found', CODES.USER_INCORRECT)
	}
}

export class UnknowProviderError extends ApolloError {
	constructor(provider) {
		super(`The provider ${provider} is not implemented`, CODES.UNKNOW_PROVIDER)
	}
}

export class BadPwdFormatError extends ApolloError {
	constructor() {
		super('Incorrect password format', CODES.PWD_FORMAT)
	}
}

export class BadEmailFormatError extends ApolloError {
	constructor() {
		super('Incorrect email format', CODES.EMAIL_FORMAT)
	}
}

export class RegistrationDisabledError extends ApolloError {
	constructor() {
		super('Registrations are currently disabled', CODES.REGISTRATION_DISABLED)
	}
}
