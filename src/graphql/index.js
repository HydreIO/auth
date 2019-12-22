import { makeExecutableSchema } from 'apollo-server-koa'
import { mergeTypes } from 'merge-graphql-schemas'
import * as resolvers from './resolvers/'
import * as schemaDirectives from './directives/'

import schema from './schema/auth.gql'
import user from './schema/user.gql'
import auth from './schema/auth.gql'

const dir = __dirname
export default makeExecutableSchema({
	typeDefs: mergeTypes([schema, user, auth]),
	resolvers,
	schemaDirectives,
	resolverValidationOptions: { requireResolversForResolveType: false }
})
