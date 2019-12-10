![][licence]

<h1 align=center>@hydre/auth</h1>

[![][discord]][discordlink] [![][twitter]][twitterlink]

[licence]: https://img.shields.io/github/license/HydreIO/doubt.svg?style=for-the-badge
[twitter]: https://img.shields.io/badge/follow-us-blue.svg?logo=twitter&style=for-the-badge
[twitterlink]: https://twitter.com/hydreio
[discord]: https://img.shields.io/discord/398114799776694272.svg?logo=discord&style=for-the-badge
[discordlink]: https://discord.gg/bRSpRpD

Serverless Oauth2 compliant authentication for AWS with a GraphQL API

> This doc is complete but minimal, if you need any help feel free to join the discord above to get a fast reply!

- [Getting started](#Setup)
- [Api](#Api)
- [Handle errors](#Errors)

# Requirements

- an AWS account with access to lambda
- a mongoDB access
- an SNS topic `auth_reset_pass`
- [serverless](https://github.com/serverless/serverless) framework

# Setup

- clone the repo
```
git clone git@github.com:HydreIO/hydre.auth.git
```
- Rename `./serverless.exemple.yml` in `./serverless.yml` (the file become untracked thus you can always pull changes from git while keeping your configuration)
- configure `./serverless.yml`, you'll see some *CHANGE ME: * fields, read the entire file
	> the no cors mode use a cookie samesite Strict
	> cors mode use a csrf token
	> (to accept a wildcard cors origin you need to create a custom ressource and disable serverless cors, create an issue if u need more explanation)
- you can also disable the serverless warmup plugin which is used to keep lambda containers warm
- deploy the lambda

```
sls deploy
```

Once the auth is online retrieve the endpoint from api gateway in your aws account or in the serverless dashboard in case you linked it.
Send a `{ ping }` query inside a client like Graphiql, don't forget to add an user-agent in the header to act like a navigator, here is one for you

```
user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36
```

You'll find any errors logged in cloudwatch logs

# Usage

To login you basically just have to query (usually on the frontend side but can totally be used by another server) for a refreshToken, in case cors are enabled the auth will send you back a CSRF token, store this token wherever you want and send it back in every request under the header `x-csrf-token`, nothing else to do if you have disabled cors

The auth will fix 2 cookie for you :
- an acces token which expire after 20min, it's the proof you're authenticated. Any server under the specified domain (in `serverless.yml`)
will receive the token and can verify (`JWT.verify`) it asymmetrically with the authentication public key (you get this key with the query `{ cert }` explained below)
if the token is valid then you can trust the request

- a refresh token, only used by the auth to fix a new accessToken in a cookie in case it is valid

Make sure you know how cookies work, the `domain` must be your services domain, for exemple if you have

- auth.foo.com
- api.foo.com

the `domain` field must be `.foo.com`, you cannot have different domains.

# Debug

You can access deep logging by setting the env variable `DEBUG` to `auth*`
Local testing `NODE_ENV` set to `development`, that way cookies will be http instead of https and webpack will not minify bundle
Every env variables is defaulted to a value so you can local test out of the box, you only need a `MONGO_URI` (create a free account on mongo atlas and you're set up)

run it with `MONGO_URI="xxx" NODE_ENV="development" DEBUG="auth*" sls offline` *ignore warnings*

# Api

## ping
Ping the api
```
{ ping }
```
return a `String!`

## cert
Retrieve the public key to verify an access token (jwt)
```
{ cert }
```
returns a `String!`

## whoami
infos on the user.
* The user is found by extracting an id (subject) of the jwt (access token) contained in a cookie
* The cookie containing the token is secure and httponly, he never expire unless the user doesn't want to stay logged, in that case it's a session cookie
* The access token (jwt) is asymmetrically signed
```
{ whoami }
```
returns an `User!` :
```
{ id, sessions: { ip, browserName, osName }, emailVerified }
```

## refreshToken
Ask for a refresh token
* A refresh token is a HMAC of the `userId` and the `sessionHash`
* A session is composed of specific common field of the user agent
* The refresh token never expire
* The refresh token is tied to the session, if the session is revoked, the token will be invalid
* A refresh token can be given in exchange of user credentials or SSO credentials, and a valid user agent
* A refresh token is only used to retrieve new access tokens

provider argument [`GOOGLE`, ..implemented soon]

```
mutation {
	refreshToken(creds: { email, pwd, rememberMe }, sso: { provider, idToken, rememberMe }, signup! }
}
```
specify creds if it's a email/pass sign, or sso if it's a _sign in with X_

returns a `String!` which is the CSRF token that must be sent on every request, a refresh token and an access token will be automatically fixed in two cookies

## accessToken
Ask for an access token
* Requires a refresh cookie and a valid CSRF token in the `x-csrf-token` header field

```
{ accessToken }
```
returns a `String!` which is a new CSRF token that must be sent on every request, the access token will be automatically updated in a cookie

## gamemodeTwo _*[DEVELOPMENT MODE ONLY]*_
Used to grant infinite access to the required user, this allow for easy integration testing but doesn't work with `cors` enabled.
This query will return an error if the env variable `NODE_ENV` is not set to `development`

```
mutation {
	gamemodeTwo(email)
}
```

return an non expiring accessToken directly instead of setting it in a cookie

## createResetCode
Generate a code to reset the user password, the code will be forwarded to an SNS topic to be futher handler by whatever service you want (for exemple another lambda that handle email sending)
- a code can only be used once

```
mutation {
	createResetCode(email)
}
```

returns true, the server will publish a message on the SNS topic `${label}:auth:reset_pass` in the form
```js
{
	to: 'user email',
	code: 'reset code'
}
```

## resetPassword
Update the user hash with a new password if the provided code is valid

```
{
	resetPassword(email, newPwd, resetCode)
}
```

returns true

## logout
Remove user cookies

```
mutation { logout }
```

returns true

## inviteUser
Register an account for someone else without setting any password, use this to create an invitation system. A `SNS` event will be triggered to `${label}:auth:invite_user` in the form
```js
{
	to: 'user email',
	code: 'reset code'
}
```

```
mutation {
	inviteUser(email)
}
```

returns a signed JWT with the `invitedId` (userid) and `email` of the newly created user or `null` if the user already exist

# Errors

Working with graphql you'll get two type of errors, `graphQLErrors` and `networkErrors`.
A graphql errors is returned as
```js
[{"errors":[{"message":"User not found","type":"USER_INCORRECT"}],"data":null}]
```

I suggest using [apollo-link-error](https://www.npmjs.com/package/apollo-link-error) as so

```js
const network = err => alert(`A wild ${err.statusCode} appeared`)
const graphql = errs => errs.forEach(({ type }) => {
	switch (type) {
		case 'USER_INCORRECT':
			// do stuff
			break
	}
})

export default onError(({ graphQLErrors, networkError, operation, forward }) => {
	if (graphQLErrors) graphql(graphQLErrors)
	else if (networkError) network(networkError)
})
```

## Definitions

| Error name | Cause |
|------------|------|
| `EMAIL_USED` | _Provided email is already used_ |
| `USER_INCORRECT` | _The user is not found_ |
| `UNKNOW_PROVIDER` | _The provider is not implemented yet (`GOOGLE` only)_ |
| `PWD_FORMAT` | _Bad password format_ |
| `EMAIL_FORMAT` | _Bad email format_ |
| `REGISTRATION_DISABLED` | _Registrations are disabled_ |
| `CSRF_INVALID` | _(only in `cors` mode) The csrf token is not valid (relog the user)_ |
| `SESSION` | _The sessions is invalid or revoked_ |
| `USER_AGENT` | _The user agent is invalid_ |
| `COOKIES` | _Cookies were not found_ |
| `HEADERS` | _Header is missing_ |
| `REFRESH_TOKEN` | _The refresh token is invalid_ |
| `ACCESS_TOKEN` | _The access token is invalid or expired_ |
| `WAIT_RESET_CODE` | _You're trying to send reset code too quickly_ |
| `RESET_CODE_INVALID` | _The reset code is not valid or already used_ |
| `GOOGLE_ID` | _Google user not found with this id_ |
| `GOOGLE_EMAIL_NOT_GRANTED` | _Google user need to grand permissions for emails_ |
| `LOCAL_ONLY` | _The queried ressources is only accessible in development mode_ |