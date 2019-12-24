import Parser from 'ua-parser-js'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { hash } from './crypt'
import { UserAgentError, InvalidAccessTokenError } from '../graphql/errors'
import { verifyAccessToken, createRefreshToken, signJwt, buildJwtOptions } from '../core/tokens'
import { ObjectID } from 'mongodb'

const fromCredentials = email => async pwd => ({ email, hash: await hash(pwd), verified: false })
const fromToken = env => token => {
	const { sub: _id, jti: sessionHash, exp, ...end } = verifyAccessToken(env.PUB_KEY)(token) || throw new InvalidAccessTokenError()
	return {
		_id, [Symbol.transient]: {
			sessionHash,
			sessionExpired: Date.now() >= exp * 1000,
			decodedJwt: end,
			token
		}
	}
}

const getSessionByHash = hash => user => user.sessions.find(s => s.hash === hash)
const deleteSessionByHash = hash => user => ((user.sessions = this.sessions.filter(s => s.hash !== hash)), user)

const idOrField = user => user._id ? { _id: new ObjectID(user._id) } : user
const fetch = collection => async user => collection.find(user |> idOrField).limit(1).toArray().then(([user]) => ({ ...user, _id: user._id.toString() }))
const push = collection => async user => collection.updateOne(user |> idOrField, { $set: user |> (({ _id, ...u }) => u) }, { upsert: true })
const exist = collection => async user => collection.find(user).limit(1).toArray().then(a => !!a.length)

const loadSession = (ip, userAgent = throw new UserAgentError()) => user => {
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
	Object.assign(user[Symbol.transient] ||= {}, { session })
	user.sessions ||=[]
	// session loading always need to be called after a database fetching so we're sure to have latest session in memory
	// in case of a registration it's not important because no sessions exist so we just append it for later saving
	if (!getSessionByHash(session.hash)(user)) {
		// and if there is too much session we disconnect the older one
		if (user.sessions.length > 10) user.sessions.shift()
		user[Symbol.transient].newSession = true
		user.sessions.push(session)
	}
	return user
}

const loadRefreshToken = ({ REFRESH_TOKEN_SECRET }) => user => {
	const session = user |> getSessionByHash(user[Symbol.transient].session.hash)
	session.refreshToken ||= createRefreshToken(REFRESH_TOKEN_SECRET)(session.hash)
	user[Symbol.transient].session.refreshToken = session.refreshToken
	return user
}

const loadAccessToken = ({ ACCESS_TOKEN_EXPIRATION, PRV_KEY }) => user => {
	const opt = buildJwtOptions('auth::service')(user._id)(user[Symbol.transient].session.hash)(`${ACCESS_TOKEN_EXPIRATION}`) // zeit https://github.com/zeit/ms
	user[Symbol.transient].accessToken = signJwt(PRV_KEY)(opt)({ email: user.email, verified: user.verified })
	return user
}

export const operate = ({ fromCredentials, getSessionByHash, deleteSessionByHash, loadSession, fromToken, loadAccessToken, loadRefreshToken })
export const ioperate = collection => ({ push: push(collection), fetch: fetch(collection), exist: exist(collection) })