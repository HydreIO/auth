import { GoogleIdNotFoundError, GoogleEmailNotFoundError, GoogleTokenError } from '../graphql/errors'
import { ApolloError } from 'apollo-server-lambda'

const googleVerify = async ({ idToken, audience }) => {
	try {
		return await client.verifyIdToken({ idToken, audience })
	} catch { throw new GoogleTokenError() }
}

export const verifyGoogleIdToken = client => clientId => async idToken => {
	const verified = await googleVerify({ idToken, audience: clientId })
	const { sub: userid = throw new GoogleIdNotFoundError(), email = throw new GoogleEmailNotFoundError()	} = verified.getPayload()
	return { userid, email }
}
