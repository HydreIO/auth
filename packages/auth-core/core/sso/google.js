import { GoogleIdNotFoundError, GoogleMailNotFoundError, GoogleTokenError } from '../../graphql/errors'

const googleVerify = client => async ({ idToken, audience }) => {
	try {
		return await client.verifyIdToken({ idToken, audience })
	} catch (e) {
		throw new GoogleTokenError()
	}
}

export const verifyGoogleIdToken = client => clientId => async idToken => {
	const verified = await googleVerify(client)({ idToken, audience: clientId })
	const { sub: userid = throw new GoogleIdNotFoundError(), mail = throw new GoogleMailNotFoundError() } = verified.getPayload()
	return { userid, mail }
}
