import apolloServer from 'apollo-server-koa'

const { defaultFieldResolver, SchemaDirectiveVisitor } = apolloServer
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
