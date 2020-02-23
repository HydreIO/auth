import { expiredRefreshCookie, expiredAccessCookie, accessCookie, refreshCookie } from './cookies'
import { UserAgentError } from '../graphql/errors'
import cookieParser from 'cookie'

export default ({ env, headers, addCookie }) => {
	const parsedCookies = cookieParser.parse(headers[Object.keys(headers).find(k => k.toLowerCase() === 'cookie')] || '')
	return {
		sendRefreshToken: token => addCookie(refreshCookie(env)(token)),
		sendAccessToken: (token, rememberMe) => addCookie(accessCookie(env)(rememberMe)(token)),
		parseUserAgent: ~Object.entries(headers).find(([key]) => key.toLocaleLowerCase() === 'user-agent')[1],
		parseAccessToken: ~parsedCookies[env.ACCESS_COOKIE_NAME],
		parseRefreshToken: ~parsedCookies[env.REFRESH_COOKIE_NAME],
		removeCookies: ~(addCookie(expiredAccessCookie(env)), addCookie(expiredRefreshCookie(env)))
	}
}