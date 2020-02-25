import * as AuthOps from './resolvers/AuthOps'
import * as Mutation from './resolvers/Mutation'
import * as Query from './resolvers/Query'
import * as UserOps from './resolvers/UserOps'
import directives from './directives'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const dir = dirname(fileURLToPath(import.meta.url))
const resolvers = { AuthOps, Mutation, Query, UserOps }
export default ({ makeExecutableSchema, defaultFieldResolver, SchemaDirectiveVisitor, gql }) => makeExecutableSchema({
	typeDefs: fs.readFileSync(`${dir}/schema.gql`, 'utf8'),
	resolvers,
	schemaDirectives: directives({ defaultFieldResolver, SchemaDirectiveVisitor }),
	inheritResolversFromInterfaces: true,
	resolverValidationOptions: { requireResolversForResolveType: false, }
})
