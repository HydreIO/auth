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

# Requirments

- an AWS account with access to lambda
- a redis cache access (Aws or external)
- a mongoDB access
- an SNS topic `auth_reset_pass`
- [serverless](https://github.com/serverless/serverless) framework

# Setup

- clone the repo
```
git clone git@github.com:HydreIO/hydre.auth.git
```

- configure the needed region in `./serverless.yml`
- you can also disable the serverless warmup plugin which is used to keep lambda containers warm
- deploy the lambda

```
sls deploy
```
- create all parameters in Aws SSM (or as env variables in the lambda)
```js
AUTH_ALLOW_REGISTRATION // weither or not allowing registration
AUTH_DB // mongo database name
AUTH_DB_COLL_USERS // mongo database collection name
AUTH_MONGO_URI // mongodb uri
AUTH_GOOGLE_ID // google application id
REDIS_ENDPOINT // redis uri 
AUTH_PWD_REGEX // regex used to verify passwords formats
AUTH_EMAIL_REGEX // regex used to verify emails formats
AUTH_CSRF_SECRET // a secret string (recommanded 32char)
AUTH_REFRESH_SECRET // a secret string (recommanded 32char)
AUTH_COOKIE_NAME // the name of the refreshtoken cookie
AUTH_ACCESS_COOKIE_NAME // the name of the accesstoken cookie
AUTH_COOKIE_DOMAIN // the cookies domain ex: '.myService.io' basically the domain where you have to access those cookies
AUTH_PUBLIC_KEY // ES512 public key
AUTH_PRIVATE_KEY // ES515 private key
AUTH_RESET_PASS_DELAY // time in ms between two password reset requests

```
Once the auth is online retrieve the endpoint from api gateway in your aws account or in the serverless dashboard in case you linked it.
Send a `{ ping }` query inside a client like Graphiql, don't forget to add an user-agent in the header to act like a navigator, here is one for you

```
user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36
```

You'll find any errors logged in cloudwatch logs

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

This is a type `query`, even though it sometimes should be a mutation
```
{
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

## createResetCode
Generate a code to reset the user password, the code will be forwarded to an SNS topic to be futher handler by whatever service you want (for exemple another lambda that handle email sending)
- a code can only be used once

```
{
	createResetCode(email)
}
```

returns true, the server will publish a message on the SNS topic `auth_reset_pass` in the form
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