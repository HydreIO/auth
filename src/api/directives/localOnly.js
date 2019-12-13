import { SchemaDirectiveVisitor } from 'graphql-tools'
import { defaultFieldResolver } from 'graphql'
import { LocalOnlyError } from '../errors'

export default class AuthDirective extends SchemaDirectiveVisitor {
	visitFieldDefinition(field) {
		const { resolve = defaultFieldResolver } = field
		field.resolve = async (root, arg, ctx, info) => {
			process.env.AUTH_ENV?.toLowerCase() === 'development' || throw new LocalOnlyError()
			return resolve.call(this, root, arg, ctx)
		}
	}
}
