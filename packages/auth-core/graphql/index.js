import { makeExecutableSchema } from 'apollo-server'
import * as resolvers from './resolvers/'
import * as schemaDirectives from './directives'
import typeDefs from './schema.gql'

const dir = __dirname
export default makeExecutableSchema({
	typeDefs,
	resolvers,
	schemaDirectives,
	inheritResolversFromInterfaces: true,
	resolverValidationOptions: { requireResolversForResolveType: false, }
})
