import { getId, isMailVerified, getSessionByHash } from '../../../user'
import { buildJwtOptions, signJwt } from '../../../utils/tokens'

const debug = 'gamemode' |> require('debug')('auth').extend

export default async (_, { email }, { findUser, session, PRV_KEY }) => {
	debug('wooosh just upgraded to godmode')
	const user = await findUser({ email })
	const opt = buildJwtOptions('auth::service')(getId(user).toString())(session.hash)(`1000d`)
	const accessToken = signJwt(PRV_KEY)(opt)({ email: user.email, mailVerified: isMailVerified(user) })
	return accessToken
}

