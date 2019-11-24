import { signJwt, buildJwtOptions } from '../../../utils/tokens'
import { ObjectID } from 'mongodb'
import crypto from 'crypto'
import { publishToSNS } from '../../../utils/sns'

const debug = 'invite' |> require('debug')('auth').extend

export default async (_, { email }, { getUser, findUser, insertUser, session, PRV_KEY, LABEL }) => {
	debug('inviting user %s', email)
	const user = await getUser()
	if (await findUser({ email })) return // no need to invite if it already exist

	const resetCode = crypto
		.createHash('sha256')
		.update(`${email}${crypto.randomBytes(32).toString('hex')}`)
		.digest('hex')
	const invited = { email, hash: undefined, sessions: [], resetCode }
	const jwtOptions = buildJwtOptions('auth::service')(user._id.toString())(session.hash)('20s')

	// notify SNS
	await publishToSNS(`${LABEL}:auth:invite_user`)(JSON.stringify({ to: email, code: resetCode }))
	return signJwt(PRV_KEY)(jwtOptions)({ invitedId: (await insertUser(invited)).insertedId.toString(), email })
}