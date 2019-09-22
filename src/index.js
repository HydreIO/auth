import api from './api'
import { loadParams } from './utils/params'
import { loadDB, getCollection } from './io/mongo'
import { loadRedis } from './io/redis'
import { apollo, forwardError } from './io/apollo'
import { buildContext } from './context'
import { OAuth2Client } from 'google-auth-library'
import { verifyGoogleIdToken } from './io/google'
import { ApolloError } from 'apollo-server-lambda'
import { HeadersError } from './api/errors'
import { createTransporter } from './utils/sns'
import { AUTH_COOKIE_DOMAIN } from './utils/constant';

// see debug npm package
const debug = 'auth' |> require('debug')

debug('initializing container')

// impure but required
// those variable are used to keep information in the lambda container
let mongo
let userColl
let redis
let googleOauth2Client
let transporter

export async function handler(event, ctx) {
	ctx.callbackWaitsForEmptyEventLoop = false
	debug('received event %O', event)
	debug('initializing lambda')

	try {
		debug('checking event integrity')
		event.headers || throw new HeadersError()

		const {
			AUTH_DB,
			AUTH_MONGO_URI,
			AUTH_DB_COLL_USERS,
			REDIS_ENDPOINT,
			AUTH_PUBLIC_KEY,
			AUTH_PRIVATE_KEY,
			AUTH_REFRESH_SECRET,
			AUTH_CSRF_SECRET,
			AUTH_GOOGLE_ID,
			AUTH_ALLOW_REGISTRATION,
			AUTH_PWD_REGEX,
			AUTH_EMAIL_REGEX,
			AUTH_ACCESS_COOKIE_NAME,
			AUTH_COOKIE_NAME,
			AUTH_COOKIE_DOMAIN,
			AUTH_RESET_PASS_DELAY
		} = await loadParams()

		debug('Parameters successfully loaded')
		debug('Initializing cache')

		mongo ||= await loadDB(AUTH_MONGO_URI)
		redis ||= loadRedis(REDIS_ENDPOINT) // unable to wait for the connection with the apollo implem
		userColl ||= getCollection(mongo)(AUTH_DB)(AUTH_DB_COLL_USERS)
		googleOauth2Client ||= new OAuth2Client(AUTH_GOOGLE_ID)

		debug('Cache successfully initialized')

		const securePayload = {
			publicKey: AUTH_PUBLIC_KEY,
			privateKey: AUTH_PRIVATE_KEY,
			refreshTokenSecret: AUTH_REFRESH_SECRET,
			csrfSecret: AUTH_CSRF_SECRET,
			ip: event.headers['CF-Connecting-IP'],
			registrationAllowed: AUTH_ALLOW_REGISTRATION !== 'FALSE',
			pwdRule: new RegExp(AUTH_PWD_REGEX),
			emailRule: new RegExp(AUTH_EMAIL_REGEX),
			accessCookie: AUTH_ACCESS_COOKIE_NAME,
			refreshCookie: AUTH_COOKIE_NAME,
			resetCodeDelay: +AUTH_RESET_PASS_DELAY,
			domain: AUTH_COOKIE_DOMAIN
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
			verifyGoogleIdToken: verifyGoogleIdToken(googleOauth2Client)(AUTH_GOOGLE_ID)
		}

		debug('ioPayload initialized')

		// return await useful in a try catch statement
		return await (event |> buildContext(securePayload)(ioPayload) |> apollo(event)(api)(redis))
	} catch (error) {
		console.error(error)
		return error instanceof ApolloError
			? forwardError(error)
			: {
					statusCode: 503,
					body: JSON.stringify('Oops.. something went wrong! Contact us if this error persist !')
			  }
	}
}
