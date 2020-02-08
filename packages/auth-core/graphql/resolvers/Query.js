import version from 'project-version'
const debug = 'query' |> require('debug')('internal').extend

export const ping = ~'subscribe to pewdiepie'
export const cert = (_, __, { env: { PUB_KEY } }) => PUB_KEY
export const stage = ~({ stage: process.env.STAGE, version })
export const me = async (_, __, { getUser }) => {
	debug('asking identity')
	const { _id: id, sessions, verified } = await getUser()
	debug('user was found')
	return { id, sessions, verified }
}