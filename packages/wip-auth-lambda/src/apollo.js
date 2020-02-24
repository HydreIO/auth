
// const caseInsensitive = object => key => object[Object.keys(object).find(k => k.toLowerCase() === key)]

// export const apollo = ({ schema, context }) =>
// 		const server = new ApolloServer({ schema, formatError, playground: false, context })
// 	const handler = server.createHandler({ cors: { origin: caseInsensitive(event.headers)('origin'), credentials: true } })
// 	handler(event, context, (err, data) => {
// 		if (err) {
// 			debug(`rejecting lambda ${err}`)
// 			rej(err)
// 		}
// 		else {
// 			const { body } = data
// 			log('🔄 %O', JSON.parse(body))
// 			if (event.cookies) {
// 				Object.assign(data.headers, event.cookies)
// 				delete event.cookies
// 			}
// 			data.headers.Vary = 'Origin'
// 			res(data)
// 		}
// 	})

// 	export const forwardError = event => apolloError => ({
// 		headers: {
// 			Vary: 'Origin',
// 			['Access-Control-Allow-Origin']: caseInsensitive(event.headers)('origin'),
// 			['Access-Control-Allow-Credentials']: 'true'
// 		},
// 		body: JSON.stringify({ errors: [formatError(apolloError)], data: null }),
// 		statusCode: 200
// 	})
