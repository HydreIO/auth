import crypto from 'crypto'
import jwt from 'jsonwebtoken'

const ALG = 'sha256'

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

export const verifyAccessToken = publicKey => token => {
	try {
		return jwt.verify(token, publicKey, {
			algorithms: 'ES512',
			issuer: 'auth.service',
			ignoreExpiration: true
		})
	} catch { }
}
