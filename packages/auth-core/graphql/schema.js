import { gql } from 'apollo-server'

export default gql`
directive @Auth(canAccessTokenBeExpired: Boolean, checkForCurrentSessionChanges: Boolean) on FIELD_DEFINITION

type Stage {
	# dev or prod
stage: String!
# x.x.x
version: String!
}

type Query {
	# pong
	ping: String!
	# stage and version
stage: Stage!
# public key
cert: String!
# hello user
me: User! @Auth
}

type Mutation {
	# gimme tokens
authenticate: AuthOps!
# misc
me: UserOps!
}

enum Provider {
	GOOGLE
	# TWITTER
	# FACEBOOK
	# GITHUB
}

input Creds {
	# the email
	email: String!
	# the password
	pwd: String!
	# only the brave will be remembered
	rememberMe: Boolean
}

type AuthOps {
	# welcome
	signup(creds: Creds!): AuthResponse!
	# welcome back
signin(creds: Creds!): AuthResponse!
# welcome sso
sign(provider: Provider!, idToken: String!): AuthResponse!
# see ya
signout: String @Auth(canAccessTokenBeExpired: true, checkForCurrentSessionChanges: false)
}

type AuthResponse {
	# you billy
user: User!
# was it a registration ?
	newAccount : Boolean!
# was it a non existing session ? usefull to implement security stuff
newSession: Boolean!
}

type Session {
	ip: String!
	browserName: String
	osName: String
	deviceModel: String
	deviceType: String
	deviceVendor: String
}

enum Code {
	RESET_PWD
	CONFIRM_EMAIL
}

type User {
	id: ID!
	sessions: [Session!]!
	verified: Boolean!
}

type UserOps {
	refresh: String @Auth(canAccessTokenBeExpired: true)
confirmEmail(email: String!, code: String!): String # void
	inviteUser(email: String!): String @Auth # jwt with id of invited user or null if it already exist
sendCode(code: Code!, email: String!): String # void
	resetPassword(email: String!, newPwd: String!, resetCode: String!): String # void
}
`