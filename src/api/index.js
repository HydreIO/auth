import { makeExecutableSchema } from 'apollo-server-lambda'
import resolvers from './resolvers'
import * as schemaDirectives from './directives/'
import typeDefs from './schema'

const dir = __dirname
export default makeExecutableSchema({
	typeDefs,
	resolvers,
	schemaDirectives,
	resolverValidationOptions: { requireResolversForResolveType: false }
})
