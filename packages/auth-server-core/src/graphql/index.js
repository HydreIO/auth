import * as AuthOps from './resolvers/AuthOps'
import * as Mutation from './resolvers/Mutation'
import * as Query from './resolvers/Query'
import * as UserOps from './resolvers/UserOps'
import * as schemaDirectives from './directives'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import apolloServer from 'apollo-server-koa'
import typeDefs from './schema.gql'

const { makeExecutableSchema } = apolloServer
const resolvers = { AuthOps, Mutation, Query, UserOps }

export default makeExecutableSchema({
	typeDefs,
	resolvers,
	schemaDirectives,
	inheritResolversFromInterfaces: true,
	resolverValidationOptions: { requireResolversForResolveType: false, }
})
