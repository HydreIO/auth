import { getId, getSessions, isMailVerified } from '../../../user'
const debug = 'whoami' |> require('debug')('auth').extend

export default async (_, __, { getUser }) => {
	debug('asking identity')
	const user = await getUser()
	debug('user was found')
	return { id: getId(user), sessions: getSessions(user), emailVerified: isMailVerified(user) }
}
