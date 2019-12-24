import { SchemaDirectiveVisitor } from 'graphql-tools'
import { defaultFieldResolver } from 'graphql'
import { AuthenticationError } from 'apollo-server-lambda'

export class Auth extends SchemaDirectiveVisitor {
	visitFieldDefinition(field) {
		const { resolve = defaultFieldResolver } = field
		const { canAccessTokenBeExpired = false } = this.args
		field.resolve = async (root, arg, ctx, info) => {
			const user = await ctx.getUser(canAccessTokenBeExpired)
			if (!user) throw new AuthenticationError('User not authenticated')
			return resolve.call(this, root, arg, ctx)
		}
	}
}