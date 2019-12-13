import cookie from 'cookie'
import { verifyAccessToken, signJwt, buildJwtOptions, createRefreshToken, verifyCSRF, signCSRF } from './utils/tokens'
import { cache } from '@hydre/commons'
import { ObjectID } from 'mongodb'
import { makeSession, getSessionByHash } from './user'
import { CSRFError, SessionError, CookiesError, InvalidAccessTokenError } from './api/errors'
import { publishToSNS } from './utils/sns'

const debug = require('debug')('auth').extend('context')

const aYear = 60 * 60 * 24 * 365 * 1

const runningInProduction = () => process.env.AUTH_ENV !== 'development'

const makeAccessCookie = cors => domain => accessCookie => rememberMe => accessToken => {
	const payload = {
		domain,
		httpOnly: true,
		secure: runningInProduction(), // by specifying development env variable we allow http cookies for test purposes,
		sameSite: cors ? 'none' : 'strict'
	}
	// 1 years cookie :) that's a lot of cookies
	// in case the user choose not be remembered, we don't set a expiration
	// that way the client will delete the cookie after a session
	// what define a session change according to the client browser
	// chrome desktop's sessions expire after browser close
	// chrome android's sessions doesn't expires (unless manual clear)
	// ios clear when app switch xD douch bags
	if (rememberMe) payload.maxAge = aYear
	if (!runningInProduction()) delete payload.domain // working in localhost we need to totally remove the field
	return cookie.serialize(accessCookie, accessToken, payload)
}

const fixCookie = event => placeholder => cookie => {
	event.cookies ||= { }
	event.cookies[placeholder] = cookie
}

const fixRefreshCookie = event => cookie => fixCookie(event)('Set-Cookie')(cookie)

const fixAccessCookie = event => cookie => fixCookie(event)('Set-cookie')(cookie)

const makeRefreshCookie = cors => domain => refreshCookie => refreshToken => {
	const payload = {
		domain,
		httpOnly: true,
		secure: runningInProduction(), // by specifying development env variable we allow http cookies for test purposes,
		maxAge: aYear,
		sameSite: cors ? 'none' : 'strict'
	}
	if (!runningInProduction()) delete payload.domain // working in localhost we need to totally remove the field
	return cookie.serialize(refreshCookie, refreshToken, payload)
}

const makeExpiredRefreshCookie = cors => domain => refreshCookie => {
	const payload = {
		domain,
		httpOnly: true,
		secure: runningInProduction(), // by specifying development env variable we allow http cookies for test purposes,
		sameSite: cors ? 'none' : 'strict',
		expires: new Date(0)
	}
	if (!runningInProduction()) delete payload.domain // working in localhost we need to totally remove the field
	return cookie.serialize(refreshCookie, 'hehe boi', payload)
}

const makeExpiredAccessCookie = cors => domain => accessCookie => {
	const payload = {
		domain,
		httpOnly: true,
		secure: runningInProduction(), // by specifying development env variable we allow http cookies for test purposes,
		sameSite: cors ? 'none' : 'strict',
		expires: new Date(0)
	}
	if (!runningInProduction()) delete payload.domain // working in localhost we need to totally remove the field
	return cookie.serialize(accessCookie, 'hehe boi', payload)
}


const eventToCsrfToken = event => event.headers['x-csrf-token']

const caseInsensitive = object => key => object[Object.keys(object).find(k => k.toLowerCase() === key)]

const eventToCookies = event => cookie.parse(caseInsensitive(event.headers)('cookie') || '')

const findUserAgent = event => Object.entries(event.headers).find(([key]) => key.toLocaleLowerCase() === 'user-agent')[1]

const cookiesToAccessToken = accessCookie => cookies => cookies[accessCookie]

const cookiesToRefreshToken = refreshCookie => cookies => cookies.find(c => c[refreshCookie]) |> (c => c && c[refreshCookie])

const userIdToDabaseUser = findUser => userId => findUser({ _id: new ObjectID(userId) })

export const buildContext = ({
	cors,
	COOKIE_DOMAIN,
	ACCESS_TOKEN_EXPIRATION,
	resetCodeDelay,
	PUB_KEY,
	PRV_KEY,
	REFRESH_TOKEN_SECRET,
	CSRF_SECRET,
	pwdRule,
	emailRule,
	ip,
	registrationAllowed,
	ACCESS_COOKIE_NAME,
	REFRESH_COOKIE_NAME,
	LABEL
}) => ({ findUser, userExist, updateUser, insertUser, verifyGoogleIdToken }) => event =>
	({
		@cache
		async getUser(canAccessTokenBeExpired) {
			const accessToken = (event |> eventToCookies |> cookiesToAccessToken(ACCESS_COOKIE_NAME)) || throw new CookiesError()
			// CSRF token is only used in case cors are enabled
			if (cors) {
				const csrfToken = (event |> eventToCsrfToken) || throw new CSRFError()
				// we ignore CSRF expiration because the auth always need to be able to provide
				verifyCSRF(CSRF_SECRET)(accessToken)(canAccessTokenBeExpired ? -1 : ACCESS_TOKEN_EXPIRATION)(csrfToken) || throw new CSRFError()
			}
			// we also ignore the JWT expiration because the auth always need to know the userid
			// accessToken have no other purposes here
			const { sub: userid, jti: hash } = verifyAccessToken(PUB_KEY)(canAccessTokenBeExpired)(accessToken) || throw new InvalidAccessTokenError()
			const user = await userIdToDabaseUser(findUser)(userid)
			return user && getSessionByHash(hash)(user) ? user : throw new SessionError()
		},

		PUB_KEY,

		PRV_KEY,

		LABEL,

		refreshToken: () => eventToCookies |> cookiesToRefreshToken(REFRESH_COOKIE_NAME),

		session: event |> findUserAgent |> makeSession(ip),

		findUser,

		userExist,

		insertUser,

		updateUser,

		verifyGoogleIdToken,

		registrationAllowed,

		resetCodeDelay,

		cors,

		checkPwdFormat: pwd => pwd.match(pwdRule),

		checkEmailFormat: mail => mail.match(emailRule),

		removeCookies: () => {
			makeExpiredAccessCookie(cors)(COOKIE_DOMAIN)(ACCESS_COOKIE_NAME) |> fixAccessCookie(event)
			makeExpiredRefreshCookie(cors)(COOKIE_DOMAIN)(REFRESH_COOKIE_NAME) |> fixRefreshCookie(event)
		},

		makeCsrfToken: accessToken => signCSRF(CSRF_SECRET)(accessToken)(),

		makeAccessToken: userId => payload => sessionHash => {
			const opt = buildJwtOptions('auth::service')(userId)(sessionHash)(`${ACCESS_TOKEN_EXPIRATION}`) // zeit https://github.com/zeit/ms
			return signJwt(PRV_KEY)(opt)(payload)
		},

		makeRefreshToken: userId => sessionHash => createRefreshToken(REFRESH_TOKEN_SECRET)(sessionHash),

		sendRefreshToken: token => token |> makeRefreshCookie(cors)(COOKIE_DOMAIN)(REFRESH_COOKIE_NAME) |> fixRefreshCookie(event),

		sendAccessToken: rememberMe => token => token |> makeAccessCookie(cors)(COOKIE_DOMAIN)(ACCESS_COOKIE_NAME)(rememberMe) |> fixAccessCookie(event)
	} |> (_ => (debug('context built'), _)))
