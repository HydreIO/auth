const extractUserId = verifiedToken => verifiedToken.getPayload()?.sub

export const verifyGoogleIdToken = client => clientId => idToken =>
	client
		.verifyIdToken({
			idToken,
			audience: clientId // Specify the CLIENT_ID of the app that accesses the backend
			// Or, if multiple clients access the backend:
			//[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
		})
		.then(extractUserId)
