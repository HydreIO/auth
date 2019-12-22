import { expiredRefreshCookie, expiredAccessCookie, accessCookie, refreshCookie } from './cookies'
import cookieParser from 'cookie'

export default event => env => {
	event.cookies ||= { }
	const fixCookie = (cookie, placeholder) => event.cookies[placeholder] = cookie
	const parseCookies = cookieParser.parse(event.headers[Object.keys(event.headers).find(k => k.toLowerCase() === 'cookie')] || '')
	return () => ({
		sendRefreshToken: token => fixCookie('Set-Cookie', refreshCookie(this.env)),
		sendAccessToken: (token, rememberMe) => fixCookie('Set-cookie', accessCookie(env)(rememberMe)),
		parseUserAgent: ~Object.entries(this.event.headers).find(([key]) => key.toLocaleLowerCase() === 'user-agent')[1],
		parseAccessToken: ~parseCookies()[this.env.ACCESS_COOKIE_NAME],
		parseRefreshToken: ~parseCookies()[this.env.REFRESH_COOKIE_NAME],
		removeCookies: ~(fixCookie('Set-cookie', expiredAccessCookie(env)), fixCookie('Set-Cookie', expiredRefreshCookie(this.env)))
	})
}