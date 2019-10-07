import cookie from 'cookie'
import { verifyAccessToken, createAccessToken, buildJwtOptions, createRefreshToken, verifyCSRF, signCSRF } from './utils/tokens'
import { cache } from '@hydre/commons'
import { ObjectID } from 'mongodb'
import { makeSession, getSessionByHash } from './user'
import { CSRFError, SessionError, CookiesError } from './api/errors'
import { publishPassReset } from './utils/sns'

const debug = require('debug')('auth').extend('context')

const aYear = 60 * 60 * 24 * 365 * 1
const min20 = 1000 * 60 * 20

const makeAccessCookie = domain => accessCookie => rememberMe => accessToken => {
	const payload = {
		domain,
		httpOnly: true,
		secure: true,
		sameSite: 'none'
	}

	// 1 years cookie :) that's a lot of cookies
	// in case the user choose not be remembered, we don't set a expiration
	// that way the client will delete the cookie after a session
	// what define a session change according to the client browser
	// chrome desktop's sessions expire after browser close
	// chrome android's sessions doesn't expires (unless manual clear)
	// ios clear when app switch xD douch bags
	if (rememberMe) payload.maxAge = aYear
	return cookie.serialize(accessCookie, accessToken, payload)
}

const fixCookie = event => placeholder => cookie => {
	event.cookies ||= {}
	event.cookies[placeholder] = cookie
}

const fixRefreshCookie = event => cookie => fixCookie(event)('Set-Cookie')(cookie)

const fixAccessCookie = event => cookie => fixCookie(event)('Set-cookie')(cookie)

const makeRefreshCookie = domain => refreshCookie => refreshToken =>
	cookie.serialize(refreshCookie, refreshToken, {
		domain,
		httpOnly: true,
		secure: true,
		maxAge: aYear,
		sameSite: 'none'
	})

const makeExpiredRefreshCookie = domain => refreshCookie =>
	cookie.serialize(refreshCookie, 'hehe boi', {
		domain,
		httpOnly: true,
		secure: true,
		sameSite: 'none',
		expires: new Date(0)
	})

const makeExpiredAccessCookie = domain => accessCookie =>
	cookie.serialize(accessCookie, 'hehe boi', {
		domain,
		httpOnly: true,
		secure: true,
		sameSite: 'none',
		expires: new Date(0)
	})

const eventToCsrfToken = event => event.headers['x-csrf-token']

const caseInsensitive = object => key => object[Object.keys(object).find(k => k.toLowerCase() === key)]

const eventToCookies = event => cookie.parse(caseInsensitive(event.headers)('cookie') || '')

const findUserAgent = event => Object.entries(event.headers).find(([key]) => key.toLocaleLowerCase() === 'user-agent')[1]

const cookiesToAccessToken = accessCookie => cookies => cookies[accessCookie]

const cookiesToRefreshToken = refreshCookie => cookies => cookies.find(c => c[refreshCookie]) |> (c => c && c[refreshCookie])

const userIdToDabaseUser = findUser => userId => findUser({ _id: new ObjectID(userId) })

export const buildContext = ({
	domain,
	resetCodeDelay,
	publicKey,
	privateKey,
	refreshTokenSecret,
	csrfSecret,
	pwdRule,
	emailRule,
	ip,
	registrationAllowed,
	accessCookie,
	refreshCookie
}) => ({ findUser, userExist, updateUser, insertUser, verifyGoogleIdToken }) => event =>
	({
		@cache
		async getUser() {
			const accessToken = event |> eventToCookies |> cookiesToAccessToken(process.env.ACCESS_COOKIE_NAME) || throw new CookiesError()
			const csrfToken = event |> eventToCsrfToken || throw new CSRFError()
			// we ignore CSRF expiration because the auth always need to be able to provide
			verifyCSRF(process.env.CSRF_SECRET)(accessToken)(-1) || throw new CSRFError()
			// we also ignore the JWT expiration because the auth always need to know the userid
			// accessToken have no other purposes here
			const { sub: userId, jti: hash } = verifyAccessToken(process.env.PUB_KEY)(true)(accessToken)
			const user = await userIdToDabaseUser(findUser)(userId)
			const sessionFound = user |> getSessionByHash(hash)
			return sessionFound ? user : throw new SessionError()
		},
		
		publicKey,

		mailResetCode: to => async code => publishPassReset(JSON.stringify({ to, code })),

		refreshToken: () => eventToCookies |> cookiesToRefreshToken(refreshCookie),

		session: event |> findUserAgent |> makeSession(ip),

		findUser,

		userExist,

		insertUser,

		updateUser,

		verifyGoogleIdToken,

		registrationAllowed,

		resetCodeDelay,

		checkPwdFormat: pwd => pwd.match(pwdRule),

		checkEmailFormat: mail => mail.match(emailRule),

		removeCookies: () => {
			makeExpiredAccessCookie(accessCookie) |> fixAccessCookie(event)
			makeExpiredRefreshCookie(domain)(refreshCookie) |> fixRefreshCookie(event)
		},

		makeCsrfToken: accessToken => signCSRF(csrfSecret)(accessToken)(),

		makeAccessToken: userId => mailVerified => sessionHash => {
			const opt = buildJwtOptions('auth::service')(userId)(sessionHash)(min20)
			return createAccessToken(privateKey)(opt)({ mailVerified })
		},

		makeRefreshToken: userId => sessionHash => createRefreshToken(refreshTokenSecret)(sessionHash),

		sendRefreshToken: token => token |> makeRefreshCookie(domain)(refreshCookie) |> fixRefreshCookie(event),

		sendAccessToken: rememberMe => token => token |> makeAccessCookie(domain)(accessCookie)(rememberMe) |> fixAccessCookie(event)
	} |> (_ => (debug('context built'), _)))
