import { mergeTypes } from 'merge-graphql-schemas'
import schema from './schema.gql'
import user from './user.gql'

export default mergeTypes([
	schema,
	user
])