import api from './api'
import { loadParams } from './utils/params'
import { loadDB, getCollection } from './io/mongo'
import { apollo, forwardError } from './io/apollo'
import { buildContext } from './context'
import { OAuth2Client } from 'google-auth-library'
import { verifyGoogleIdToken } from './io/google'
import { ApolloError } from 'apollo-server-lambda'
import { HeadersError } from './api/errors'
import { createTransporter } from './utils/sns'
import { AUTH_COOKIE_DOMAIN } from './utils/constant'

// see debug npm package
const debug = 'auth' |> require('debug')

debug('initializing container')

// impure but required
// those variable are used to keep information in the lambda container
let mongo
let userColl
let googleOauth2Client

export async function handler(event, ctx) {
	ctx.callbackWaitsForEmptyEventLoop = false

	if (event.source === 'serverless-plugin-warmup') return 'Lambda is warm!'

	debug('received event %O', event)
	debug('initializing lambda')

	try {
		debug('checking event integrity')
		event.headers || throw new HeadersError()

		const {
			DATABASE,
			MONGO_URI,
			COLLECTION,
			PUB_KEY,
			PRV_KEY,
			REFRESH_TOKEN_SECRET,
			CSRF_SECRET,
			GOOGLE_ID,
			ALLOW_REGISTRATION,
			PWD_REGEX,
			EMAIL_REGEX,
			ACCESS_COOKIE_NAME,
			REFRESH_COOKIE_NAME,
			COOKIE_DOMAIN,
			RESET_PASS_DELAY
		} = process.env

		debug('Parameters successfully loaded')
		debug('Initializing cache')

		mongo ||= await loadDB(MONGO_URI)
		userColl ||= getCollection(mongo)(DATABASE)(COLLECTION)
		googleOauth2Client ||= new OAuth2Client(GOOGLE_ID)

		debug('Cache successfully initialized')

		const securePayload = {
			publicKey: PUB_KEY,
			privateKey: PRV_KEY,
			refreshTokenSecret: REFRESH_TOKEN_SECRET,
			csrfSecret: CSRF_SECRET,
			ip: event.requestContext.identity.sourceIp,
			registrationAllowed: ALLOW_REGISTRATION === 'TRUE',
			pwdRule: new RegExp(PWD_REGEX),
			emailRule: new RegExp(EMAIL_REGEX),
			accessCookie: ACCESS_COOKIE_NAME,
			refreshCookie: REFRESH_COOKIE_NAME,
			resetCodeDelay: +RESET_PASS_DELAY,
			domain: COOKIE_DOMAIN
		}

		const ioPayload = {
			findUser: async datas =>
				userColl
					.find(datas)
					.limit(1)
					.toArray()
					.then(([user]) => user),
			userExist: async datas =>
				userColl
					.find(datas)
					.limit(1)
					.toArray()
					.then(a => !!a.length),
			insertUser: ::userColl.insertOne,
			updateUser: filter => async datas =>
				userColl.updateOne(filter, {
					$set: datas
				}),
			verifyGoogleIdToken: verifyGoogleIdToken(googleOauth2Client)(GOOGLE_ID)
		}

		debug('ioPayload initialized')

		// return await useful in a try catch statement
		return await (event |> buildContext(securePayload)(ioPayload) |> apollo(event)(api))
	} catch (error) {
		console.error(error)
		return error instanceof ApolloError
			? forwardError(event)(error)
			: {
					statusCode: 503,
					body: JSON.stringify('Oops.. something went wrong! Contact us if this error persist !')
			  }
	}
}
