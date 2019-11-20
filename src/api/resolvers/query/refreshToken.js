import { hash, verify } from '../../../utils/crypt'
import { getId, getPwdHash, getSessionByHash } from '../../../user'
import {
	UserNotFoundError,
	BadPwdFormatError,
	BadEmailFormatError,
	EmailUsedError,
	UnknowProviderError,
	RegistrationDisabledError
} from '../../errors'
import { ObjectID } from 'mongodb'

const debug = 'refresh' |> require('debug')('auth').extend

const userFromCreds = ({ email, pwd }) => signup => async ({
	userExist,
	findUser,
	registrationAllowed,
	partialSave,
	checkPwdFormat,
	session,
	checkEmailFormat
}) => {
	debug('checking password and email format')
	checkPwdFormat(pwd) || throw new BadPwdFormatError()
	checkEmailFormat(email) || throw new BadEmailFormatError()
	debug('formats are correct')

	if (signup) {
		registrationAllowed || throw new RegistrationDisabledError()
		debug('checking if the user already exist')
		if (await userExist({ email })) throw new EmailUsedError(email)
		debug(`user doesn't exist, creating..`)
		// inserting the google mail only at account creation as this mail can change on the google account
		return { email, hash: await hash(pwd), sessions: [session] }
	}

	debug('finding user with email %s', email)

	// user from database
	const user = (await findUser({ email })) || throw new UserNotFoundError()

	debug('verifying password hash')
		// verifying password
		; (await verify(pwd)(user.hash)) || throw new UserNotFoundError()

	return user
}

const userFromGoogle = ({ findUser, registrationAllowed, partialSave, verifyGoogleIdToken, session }) => async idToken => {
	debug('verifying google id_token')
	const { userid, email } = await verifyGoogleIdToken(idToken)

	debug('finding user with google id')
	const userDatas = { sso: { google: userid } }
	const user = await findUser(userDatas)
	if (!user) {
		registrationAllowed || throw new RegistrationDisabledError()
		return { email, ...userDatas, sessions: [session] }
	}
	return user
}

const userFromSSO = ({ provider, idToken }) => signup => ctx => {
	switch (provider) {
		case 'GOOGLE':
			debug('the provider is google')
			return userFromGoogle(ctx)(idToken)
		default:
			throw new UnknowProviderError()
	}
}

export default async (_, { creds, sso, signup }, ctx) => {
	debug('asking for a refresh token (signup=%o)', signup)
	const resolveUser = creds ? userFromCreds(creds) : userFromSSO(sso)
	const user = await resolveUser(signup)(ctx)

	debug('resolving id')
	const id = user ?._id ?.toString() || (await ctx.insertUser(user)).insertedId ?.toString()

	debug('creating refresh token..')
	const refreshToken = ctx.makeRefreshToken(id)(ctx.session.hash)
	if (user.sessions.length > 10) user.sessions.shift()
	const session =
		getSessionByHash(ctx.session.hash)(user) ||
		do {
		user.sessions.push(ctx.session)
		return ctx.session
	}
	session.refreshToken = refreshToken

	debug('upserting user')
	await ctx.updateUser({ _id: new ObjectID(id) })(user)

	debug('fixing refresh token')
	ctx.sendRefreshToken(refreshToken)
	return (
		ctx.makeAccessToken(id)({
			email: user.email,
			mailVerified: false
		})(ctx.session.hash)
		|> (_ => (debug('created accessToken [%s]', _), _))
		|> (token => (ctx.sendAccessToken((creds || sso).rememberMe)(token), token))
		|> ctx.makeCsrfToken
	)
}
