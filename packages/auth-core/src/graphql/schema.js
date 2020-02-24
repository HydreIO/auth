import apolloServer from 'apollo-server'
const { gql } = apolloServer
export default gql`
directive @Auth(canAccessTokenBeExpired: Boolean, checkForCurrentSessionChanges: Boolean) on FIELD_DEFINITION

type Query {
	# pong
	ping: String!
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
	# the mail
	mail: String!
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
	uuid: ID!
	mail: String!
	sessions: [Session!]!
	verified: Boolean!
}

type UserOps {
	refresh: String @Auth(canAccessTokenBeExpired: true)
	confirmMail(mail: String!, code: String!): String # void
	inviteUser(mail: String!): String @Auth # jwt with id of invited user or null if it already exist
	sendCode(code: Code!, mail: String!): String # void
	resetPassword(mail: String!, newPwd: String!, resetCode: String!): String # void
}
`