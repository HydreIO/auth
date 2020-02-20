import { SchemaDirectiveVisitor } from 'apollo-server'
import { defaultFieldResolver } from 'graphql'

export class Auth extends SchemaDirectiveVisitor {
	visitFieldDefinition(field) {
		const { resolve = defaultFieldResolver } = field
		const opt = this.args
		field.resolve = async (root, arg, ctx, info) => {
			// will throw errors in case the user is not authenticated
			await ctx.getUser(opt)
			return resolve.call(this, root, arg, ctx)
		}
	}
}