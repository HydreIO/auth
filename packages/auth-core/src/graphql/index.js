import apolloServer from 'apollo-server'
import * as AuthOps from './resolvers/AuthOps'
import * as Mutation from './resolvers/Mutation'
import * as Query from './resolvers/Query'
import * as UserOps from './resolvers/UserOps'
import * as schemaDirectives from './directives'
import typeDefs from './schema'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const { makeExecutableSchema } = apolloServer
const dir = dirname(fileURLToPath(import.meta.url))
const resolvers = { AuthOps, Mutation, Query, UserOps }
export default makeExecutableSchema({
	typeDefs,
	resolvers,
	schemaDirectives,
	inheritResolversFromInterfaces: true,
	resolverValidationOptions: { requireResolversForResolveType: false, }
})
