const debug = 'invite' |> require('debug')('auth').extend

export default async (_, { email }, { findUser, insertUser }) => {
	debug('inviting user %s', email)
	const user = await findUser({ email })
	return { userid: (user ?._id || (await insertUser({ email, hash: undefined, sessions: [] })).insertedId).toString(), email }
}
