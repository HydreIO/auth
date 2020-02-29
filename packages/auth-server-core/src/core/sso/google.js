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
	const { sub: userid, mail } = verified.getPayload()
	if (!userid) throw new GoogleIdNotFoundError()
	if (!mail) throw new GoogleMailNotFoundError()
	return { userid, mail }
}
