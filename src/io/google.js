import { GoogleIdNotFound, GoogleEmailNotFound } from '../api/errors'

export const verifyGoogleIdToken = client => clientId => idToken => {
	const { sub: userid = throw new GoogleIdNotFound(), email = throw new GoogleEmailNotFound() } = client.verifyIdToken({
		idToken,
		audience: clientId // Specify the CLIENT_ID of the app that accesses the backend
		// Or, if multiple clients access the backend:
		//[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
	}).getPayload()
	return { userid, email }
}
