import { mergeTypes } from 'merge-graphql-schemas'
import schema from './schema.gql'
import user from './user.gql'
import invitedUser from './invitedUser.gql'

export default mergeTypes([
	schema,
	user,
	invitedUser
])