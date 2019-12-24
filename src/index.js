import schema from './graphql'
import { loadDB, getCollection } from './io/mongo'
import { apollo, forwardError } from './io/apollo'
import { buildContext } from './core/context'
import { OAuth2Client } from 'google-auth-library'
import { verifyGoogleIdToken } from './io/google'
import { ApolloError } from 'apollo-server-lambda'
import { HeadersError } from './graphql/errors'
import { createTransporter } from './core/sns'

// see debug npm package
const debug = 'auth' |> require('debug')
Symbol.transient = Symbol()

debug('initializing container')

// impure but required
// those variable are used to keep information in the lambda container
let mongo
let userColl
let googleOauth2Client

export async function handler(event, ctx) {
	ctx.callbackWaitsForEmptyEventLoop = false

	if (event.source === 'serverless-plugin-warmup') return 'Lambda is warm!'

	// debug('received event %O', event)
	debug('initializing lambda')

	try {
		debug('checking event integrity')
		event.headers || throw new HeadersError()

		const {
			DATABASE, // db name
			MONGO_URI, // mongo host (atlas like)
			COLLECTION, // auth collection name
			PUB_KEY, // ES512
			PRV_KEY, // ES512
			REFRESH_TOKEN_SECRET, // secret string, the default value is for testing purposes only !
			CSRF_SECRET, // secret string
			GOOGLE_ID, // google app id (sso)
			ALLOW_REGISTRATION, // can we register ? (TRUE, FALSE) case sensitive
			PWD_REGEX, // accept which type of pwd
			EMAIL_REGEX, // accept wich type of email
			ACCESS_COOKIE_NAME, // name of the accessToken cookie (share this with your others services)
			REFRESH_COOKIE_NAME, // refresh cookie name (only used by auth)
			COOKIE_DOMAIN, // domain for the refresh
			RESET_PASS_DELAY, // ms between two pwd reset request
			CORS,  // with cors enabled you can authenticate an user coming from a different domain website, this activate csrf token protection
			// when cors are disabled the cookies sent become samesite Strict
			VPC, // When in a vpc the agw event use a different path to store caller ip adress
			ACCESS_TOKEN_EXPIRATION,
			LABEL
		} = process.env

		debug('Parameters successfully loaded')
		debug('Initializing cache')

		mongo ||= await loadDB(MONGO_URI)
		userColl ||= getCollection(mongo)(DATABASE)(COLLECTION)
		googleOauth2Client ||= new OAuth2Client(GOOGLE_ID)

		debug('Cache successfully initialized')

		const env = {
			PUB_KEY,
			PRV_KEY,
			REFRESH_TOKEN_SECRET,
			IP: VPC.toLowerCase() === 'true' ? event.headers['CF-Connecting-IP'] : event.requestContext.identity.sourceIp,
			ALLOW_REGISTRATION: ALLOW_REGISTRATION.toLowerCase() === 'true',
			PWD_REGEX: new RegExp(PWD_REGEX),
			EMAIL_REGEX: new RegExp(EMAIL_REGEX),
			ACCESS_COOKIE_NAME,
			REFRESH_COOKIE_NAME,
			RESET_PASS_DELAY: +RESET_PASS_DELAY,
			COOKIE_DOMAIN,
			ACCESS_TOKEN_EXPIRATION,
			LABEL
		}

		const sso = {
			verifyGoogleIdToken: verifyGoogleIdToken(googleOauth2Client)(GOOGLE_ID)
		}

		const context = buildContext(env)(userColl)(sso)(event)
		// return await useful in a try catch statement
		return await apollo(event)(schema)(context)
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
