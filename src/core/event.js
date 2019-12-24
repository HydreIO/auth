import { expiredRefreshCookie, expiredAccessCookie, accessCookie, refreshCookie } from './cookies'
import { UserAgentError } from '../graphql/errors'
import cookieParser from 'cookie'

export default event => env => {
	event.cookies ||= { }
	const fixCookie = (placeholder, cookie) => event.cookies[placeholder] = cookie
	const parsedCookies = cookieParser.parse(event.headers[Object.keys(event.headers).find(k => k.toLowerCase() === 'cookie')] || '')
	return {
		sendRefreshToken: token => fixCookie('Set-Cookie', refreshCookie(env)(token)),
		sendAccessToken: (token, rememberMe) => fixCookie('Set-cookie', accessCookie(env)(rememberMe)(token)),
		parseUserAgent: ~Object.entries(event.headers).find(([key]) => key.toLocaleLowerCase() === 'user-agent')[1],
		parseAccessToken: ~parsedCookies[env.ACCESS_COOKIE_NAME],
		parseRefreshToken: ~parsedCookies[env.REFRESH_COOKIE_NAME],
		removeCookies: ~(fixCookie('Set-cookie', expiredAccessCookie(env)), fixCookie('Set-Cookie', expiredRefreshCookie(env)))
	}
}