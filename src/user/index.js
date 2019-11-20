import Parser from 'ua-parser-js'
import crypto from 'crypto'
import { UserAgentError } from '../api/errors'

export const makeSession = ip => userAgent => {
	const ua = new Parser(userAgent)
	const { name: browserName } = ua.getBrowser()
	const { model: deviceModel, type: deviceType, vendor: deviceVendor } = ua.getDevice()
	const { name: osName } = ua.getOS()
	if (!browserName && !deviceVendor) throw new UserAgentError()
	const session = {
		ip,
		browserName,
		deviceModel,
		deviceType,
		deviceVendor,
		osName
	}
	return {
		...session,
		hash: session |> getSessionHash
	}
}

export const getId = user => user._id
export const getPwdHash = user => user.hash
export const getSessions = user => user.sessions
export const isMailVerified = user => user.emailVerified
export const getSessionByHash = hash => user =>
	user |> getSessions |> (arr => arr.find(s => s.hash === hash))
export const getSessionHash = session =>
	crypto
		.createHash('md5')
		.update(JSON.stringify(session))
		.digest('hex')