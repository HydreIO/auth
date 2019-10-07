import { ApolloServer } from 'apollo-server-lambda'
import PrettyError from 'pretty-error'
const debug = 'error' |> require('debug')('auth').extend
const adebug = 'apollo' |> require('debug')('auth').extend
const pe = new PrettyError()

const formatError = error =>
	({ message: error.message, type: error.extensions.code }
	|> (_ => (debug(pe.render({ ...error, stack: error.extensions?.exception?.stacktrace?.join('\n') })), _)))

const caseInsensitive = object => key => object[Object.keys(object).find(k => k.toLowerCase() === key)]

export const apollo = event => schema => context =>
	new Promise(
		(res, rej) =>
			void new ApolloServer({
				schema,
				formatError,
				playground: false,
				context
			}).createHandler({
				cors: {
					origin: caseInsensitive(event.headers)('origin'),
					credentials: true
				}
			})(
				event,
				context,
				(err, data) =>
					void (err
						? rej(
								do {
									console.log('rejected: ', err)
									return err
								}
						  )
						: res(
								do {
									adebug('resolving lambda %O', data)
									if (event.cookies) {
										Object.assign(data.headers, event.cookies)
										delete event.cookies
									}
									data.headers.Vary = 'Origin'
									return data
								}
						  ))
			)
	)

export const forwardError = apolloError => ({
	body: JSON.stringify({ errors: [formatError(apolloError)], data: null }),
	statusCode: 200
})
