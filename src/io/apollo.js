import { ApolloServer } from 'apollo-server-lambda'
import PrettyError from 'pretty-error'
const debug = 'apollo' |> require('debug')('auth').extend
const log = 'graphql' |> require('debug')('auth').extend
const pe = new PrettyError()

const formatError = error => {
	let { message, extensions: { code: type } } = error
	debug.extend('err')(pe.render({ ...error, stack: error.extensions ?.exception ?.stacktrace ?.join('\n') }))
	if (type === 'INTERNAL_SERVER_ERROR') message = 'Oops.. something went wrong! Contact us if this error persist !'
	return { message, type }
}

const caseInsensitive = object => key => object[Object.keys(object).find(k => k.toLowerCase() === key)]

export const apollo = event => schema => context =>
	new Promise((res, rej) => {
		const server = new ApolloServer({ schema, formatError, playground: false, context })
		const handler = server.createHandler({ cors: { origin: caseInsensitive(event.headers)('origin'), credentials: true } })
		handler(event, context, (err, data) => {
			if (err) {
				debug(`rejecting lambda ${err}`)
				rej(err)
			}
			else {
				const { body } = data
				log('🔄 %O', JSON.parse(body))
				// debug('resolving lambda %O', { body: JSON.parse(body), ...rest })
				if (event.cookies) {
					Object.assign(data.headers, event.cookies)
					delete event.cookies
				}
				data.headers.Vary = 'Origin'
				res(data)
			}
		})
	})

export const forwardError = event => apolloError => ({
	headers: {
		Vary: 'Origin',
		['Access-Control-Allow-Origin']: caseInsensitive(event.headers)('origin'),
		['Access-Control-Allow-Credentials']: 'true'
	},
	body: JSON.stringify({ errors: [formatError(apolloError)], data: null }),
	statusCode: 200
})
