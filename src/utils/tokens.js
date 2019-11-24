import crypto from 'crypto'
import jwt from 'jsonwebtoken'

const ALG = 'sha256'

export const signCSRF = csrfSecret => accessToken => (timestamp = Date.now()) => {
	const HMAC = crypto
		.createHmac(ALG, csrfSecret)
		.update(`${timestamp}${accessToken}`)
		.digest('hex')
	return `${HMAC}.${timestamp}`
}

const isExpired = timestamp => expiration => expiration !== -1 && Date.now() - timestamp > expiration

export const verifyCSRF = csrfSecret => accessToken => expiration => csrfToken => {
	const [HMAC, timestamp] = csrfToken.split('.')
	const [reHMAC] = signCSRF(csrfSecret)(accessToken)(timestamp).split('.')
	return !isExpired(timestamp)(expiration) && HMAC === reHMAC
}

export const createRefreshToken = refreshTokenSecret => sessionHash =>
	crypto
		.createHmac(ALG, refreshTokenSecret)
		.update(`${crypto.randomBytes(32).toString('hex')}${sessionHash}`)
		.digest('hex')

export const buildJwtOptions = audience => userId => sessionHash => expiresIn => ({
	algorithm: 'ES512',
	expiresIn, // auto verified by jsonwebtoken lib
	audience, // not really used yet
	issuer: 'auth.service', // should be verified
	// used to verify that the session wasn't revoked in the db (when fetching user)
	jwtid: sessionHash, // should be verified
	subject: userId
	// mutatePayload: true
})

export const signJwt = privateKey => opt => datas => jwt.sign(datas, privateKey, opt)

export const verifyAccessToken = publicKey => ignoreExpiration => token => {
	try {
		return jwt.verify(token, publicKey, {
			algorithms: 'ES512',
			issuer: 'auth.service',
			ignoreExpiration
		})
	} catch {}
}
