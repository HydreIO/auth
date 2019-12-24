import { ApolloServer } from 'apollo-server-lambda'
import PrettyError from 'pretty-error'
const debug = 'apollo' |> require('debug')('auth').extend
const pe = new PrettyError()

const formatError = error =>
	({ message: error.message, type: error.extensions.code }
		|> (_ => (debug(pe.render({ ...error, stack: error.extensions ?.exception ?.stacktrace ?.join('\n') })), _)))

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
				const { body, ...rest } = data
				debug('resolving lambda %O', { body: JSON.parse(body), ...rest })
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
