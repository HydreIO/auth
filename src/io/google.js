import { GoogleIdNotFoundError, GoogleEmailNotFoundError, GoogleTokenError } from '../graphql/errors'
import { ApolloError } from 'apollo-server-lambda'

const googleVerify = client => async ({ idToken, audience }) => {
	try {
		return await client.verifyIdToken({ idToken, audience })
	} catch(e) {
		console.error(e)
		throw new GoogleTokenError()
	 }
}

export const verifyGoogleIdToken = client => clientId => async idToken => {
	const verified = await googleVerify(client)({ idToken, audience: clientId })
	const { sub: userid = throw new GoogleIdNotFoundError(), email = throw new GoogleEmailNotFoundError()	} = verified.getPayload()
	return { userid, email }
}
