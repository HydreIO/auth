const debug = 'mutation' |> require('debug')('auth').extend

export const me = ~({})
export const authenticate = ~({})

export const refreshMe = async (_, __, { getUser, env, userOps: { loadAccessToken, loadRefreshToken }, eventOps: { sendAccessToken } }) => {
	debug('asking for an accessToken')
	const user = (await getUser(true)) |> loadAccessToken(env)
	sendAccessToken(user[Symbol.transient].accessToken, true)
	return true
}