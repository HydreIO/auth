const debug = 'authOps' |> require('debug')('auth').extend

export const signout = async (_, __, { eventOps: { removeCookies }, getUser, userIops: { push }, userOps: { deleteSessionByHash } }) => {
	debug('loging out..')
	const user = await getUser()
	debug('deleting session..')
	user |> deleteSessionByHash(user[Symbol.transient].session.hash)
	debug('removing cookies..')
	removeCookies()
	return true
}