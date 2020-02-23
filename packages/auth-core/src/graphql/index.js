import { makeExecutableSchema } from 'apollo-server'
import * as AuthOps from './resolvers/AuthOps'
import * as Mutation from './resolvers/Mutation'
import * as Query from './resolvers/Query'
import * as UserOps from './resolvers/UserOps'
import * as schemaDirectives from './directives'
import typeDefs from './schema'

const dir = __dirname
const resolvers = { AuthOps, Mutation, Query, UserOps }
export default makeExecutableSchema({
	typeDefs,
	resolvers,
	schemaDirectives,
	inheritResolversFromInterfaces: true,
	resolverValidationOptions: { requireResolversForResolveType: false, }
})
