import { SchemaDirectiveVisitor } from 'graphql-tools'
import { defaultFieldResolver } from 'graphql'
import { DisabledError, InvalidRefreshTokenError } from './errors'
import { AuthenticationError } from 'apollo-server-lambda'

export default class Auth extends SchemaDirectiveVisitor {
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

export default class VerifyRefreshToken extends SchemaDirectiveVisitor {
	visitFieldDefinition(field) {
		const { resolve = defaultFieldResolver } = field
		field.resolve = async (root, arg, ctx, info) => {
			const user = await ctx.getUser(true)
			const sess = ctx.userOps.getSessionByHash(user[Symbol.transient].sessionHash)
			if (sess.refreshToken !== ctx.eventOps.parseRefreshToken()) throw new InvalidRefreshTokenError()
			return resolve.call(this, root, arg, ctx)
		}
	}
}
