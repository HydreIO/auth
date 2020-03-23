import Parser from 'ua-parser-js'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { hash } from './utils/crypt'
import { UserAgentError, InvalidAccessTokenError } from '../graphql/errors'
import { verifyAccessToken, createRefreshToken, signJwt, buildJwtOptions } from './tokens'
import Debug from 'debug'

const debug = Debug('auth').extend('user')

Symbol.transient = Symbol('transient')

const fromCredentials = mail => async pwd => ({ mail, hash: await hash(pwd), verified: false })
const fromToken = env => token => {
	const jwt = verifyAccessToken(env.PUB_KEY)(token)
	if (!jwt) throw new InvalidAccessTokenError()
	const { sub: uuid, jti: sessionHash, exp, ...end } = jwt
	return {
		uuid, [Symbol.transient]: {
			sessionHash,
			sessionExpired: Date.now() >= exp * 1000,
			decodedJwt: end,
			token
		}
	}
}

const getSessionByHash = hash => user => user.sessions.find(s => s.hash === hash)
const deleteSessionByHash = hash => user => ((user.sessions = user.sessions.filter(s => s.hash !== hash)), user)

const loadSession = (ip, userAgent) => user => {
	if (!userAgent) throw new UserAgentError()
	const ua = new Parser(userAgent)
	const { name: browserName } = ua.getBrowser()
	const { model: deviceModel, type: deviceType, vendor: deviceVendor } = ua.getDevice()
	const { name: osName } = ua.getOS()
	if (!browserName && !deviceVendor) throw new UserAgentError()
	const sessionFields = {
		ip,
		browserName,
		deviceModel,
		deviceType,
		deviceVendor,
		osName
	}
	const session = { ...sessionFields, hash: crypto.createHash('md5').update(JSON.stringify(sessionFields)).digest('hex') }
	if (!user[Symbol.transient]) user[Symbol.transient] = {}
	Object.assign(user[Symbol.transient], { session })
	if (!user.sessions) user.sessions = []
	// session loading always need to be called after a database fetching so we're sure to have latest session in memory
	// in case of a registration it's not important because no sessions exist so we just append it for later saving
	if (!getSessionByHash(session.hash)(user)) {
		// and if there is too much session we disconnect the older one
		if (user.sessions.length >= 10) user.sessions.shift()
		user[Symbol.transient].newSession = true
		user.sessions.push(session)
	}
	return user
}

const loadRefreshToken = ({ REFRESH_TOKEN_SECRET }) => user => {
	const session = getSessionByHash(user[Symbol.transient].session.hash)(user)
	if (!session.refreshToken) session.refreshToken = createRefreshToken(REFRESH_TOKEN_SECRET)(session.hash)
	user[Symbol.transient].session.refreshToken = session.refreshToken
	return user
}

const loadAccessToken = ({ ACCESS_TOKEN_EXPIRATION, PRV_KEY }) => user => {
	const opt = buildJwtOptions('auth::service')(user.uuid)(user[Symbol.transient].session.hash)(`${ACCESS_TOKEN_EXPIRATION}`) // zeit https://github.com/zeit/ms
	user[Symbol.transient].accessToken = signJwt(PRV_KEY)(opt)({ mail: user.mail, verified: user.verified })
	return user
}

export const operate = ({ fromCredentials, getSessionByHash, deleteSessionByHash, loadSession, fromToken, loadAccessToken, loadRefreshToken })
