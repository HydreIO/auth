import { operate as userOps } from './user'
import { SessionError, CookiesError, UserNotFoundError } from '../graphql/errors'
import EventOps from './event'
import { verifyGoogleIdToken } from './sso/google'
import gal from 'google-auth-library'
import Debug from 'debug'

const { OAuth2Client } = gal
const debug = Debug('internal').extend('context')
const googleClient = new OAuth2Client(process.env.GOOGLE_ID)

export const buildContext = ({ env, event, crud }) => {
	const eventOps = EventOps({ env, headers: event.headers, addCookie: event.addCookie })
	let cachedUser
	return {
		/**
		 * Retrieve an authenticated user
		 * @param {Object} options canAccessTokenBeExpired: wether or not check for jwt expiration, checkForCurrentSessionChanges: wether or not checking if the session used to build the access token is the same as the current user session
		 */
		async getUser({ canAccessTokenBeExpired = false, checkForCurrentSessionChanges = true } = {}) {
			// memoizing a function with argument can be dangerous, always make sure that a route
			// with the @auth directive use the same arguments as in the resolver
			// this could be optimized by also memoizing arguments but it would add overhead
			// as the data could be fetched twice, better to be careful with arguments than spending bandwith
			if (cachedUser) return cachedUser
			debug('.......retrieving user %O', { canAccessTokenBeExpired, checkForCurrentSessionChanges })
			const token = eventOps.parseAccessToken()
			if (!token) throw new CookiesError()
			const user = userOps.loadSession(env.IP, eventOps.parseUserAgent(event))(userOps.fromToken(env)(token))

			// The user must exist in the database
			const dbUser = await crud.fetchByUid(user.uuid)
			if (!dbUser) throw new UserNotFoundError()

			// The user current session must be valid
			// notice that we check on the DBUSER with the sessionHash from the received JWT
			const session = userOps.getSessionByHash(user[Symbol.transient].sessionHash)(dbUser)
			if (!session) throw new SessionError()
			if (checkForCurrentSessionChanges)
				// This should not happen unless the user cookies are stolen or user-agent update on the same session
				if (user[Symbol.transient].session.hash !== user[Symbol.transient].sessionHash) throw new SessionError()

			// The user current session may not be expired
			if (!canAccessTokenBeExpired && user[Symbol.transient].sessionExpired) throw new SessionError()

			// The merge order is important, retrieving an user from an access token mean that the user is authenticated
			// we then want to be sure there is no alteration of this existing user
			// so we give the merge priority to the dbUser
			// no data should be added localy unless it is a signup/signin operation
			cachedUser = { ...user, ...dbUser }
			return cachedUser
		}, env, userOps, crud, eventOps, sso: { verifyGoogleIdToken: verifyGoogleIdToken(googleClient)(env.GOOGLE_ID) }
	}
}

