import { operate as userOps, ioperate } from './user'
import { cache } from '@hydre/commons'
import User from './user'
import { SessionError, CookiesError, UserNotFoundError } from '../graphql/errors'
import EventOps from './event'

const debug = require('debug')('auth').extend('context')

export const buildContext = env => collection => sso => event => {
	const userIops = ioperate(collection)
	const eventOps = EventOps(event)(env)
	return {
		@cache
		async getUser(canAccessTokenBeExpired) {
			const token = eventOps.parseAccessToken() || throw new CookiesError()
			const user = userOps.fromToken(env)(token) |> userOps.loadSession(env.IP, eventOps.parseUserAgent(event))

			// The user must exist in the database
			const dbUser = await userIops.fetch(user)
			dbUser || throw new UserNotFoundError()

			// The user current session must be valid
			// notice that we check on the DBUSER and not the local
			const session = dbUser |> userOps.getSessionByHash(user[Symbol.transient].sessionHash)
			session || throw new SessionError()

			// This should not happen unless the user cookies are stolen or user-agent update on the same session
			if (user[Symbol.transient].session.hash !== user[Symbol.transient].sessionHash) throw new SessionError()

			// The user current session may not be expired
			if (!canAccessTokenBeExpired && user[Symbol.transient].sessionExpired) throw new SessionError()

			// The merge order is important, retrieving an user from an access token mean that the user is authenticated
			// we then want to be sure there is no alteration of this existing user
			// so we give the merge priority to the dbUser
			// no data should be added localy unless it is a signup/signin operation
			return { ...user, ...dbUser }
		}, env, userOps, userIops, eventOps, sso
	}
}

