import { SchemaDirectiveVisitor } from 'graphql-tools'
import { defaultFieldResolver } from 'graphql'
import { InvalidRefreshTokenError } from '../errors'

export default class RefreshTokenDirective extends SchemaDirectiveVisitor {
	visitFieldDefinition(field) {
		const { resolve = defaultFieldResolver } = field
		field.resolve = async (root, arg, ctx, info) => {
			const user = await ctx.getUser(true)
			const sess = getSessionByHash(ctx.session.hash)(user)
			if (sess.refreshToken !== ctx.refreshToken()) throw new InvalidRefreshTokenError()
			return resolve.call(this, root, arg, ctx)
		}
	}
}
