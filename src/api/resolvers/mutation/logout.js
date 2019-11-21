const debug = 'logout' |> require('debug')('auth').extend

export default (_, __, { removeCookies }) => {
	debug('loging out')
	removeCookies()
	return true
}
