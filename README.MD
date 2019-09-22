![][licence]

<h1 align=center>@hydre/auth</h1>

[![][discord]][discordlink] [![][twitter]][twitterlink]

[licence]: https://img.shields.io/github/license/HydreIO/doubt.svg?style=for-the-badge
[twitter]: https://img.shields.io/badge/follow-us-blue.svg?logo=twitter&style=for-the-badge
[twitterlink]: https://twitter.com/hydreio
[discord]: https://img.shields.io/discord/398114799776694272.svg?logo=discord&style=for-the-badge
[discordlink]: https://discord.gg/bRSpRpD

Serverless Oauth2 compliant authentication for AWS

# Requirments

- An AWS account with access to lambda
- A redis cache access (Aws or external)
- A mongoDB access

# Setup



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
return a `String!`

## whoami
infos on the user.
* The user is found by extracting an id (subject) of the jwt (access token) contained in a cookie
* The cookie containing the token is secure and httponly, he never expire unless the user doesn't want to stay logged, in that case it's a session cookie
* The access token (jwt) is asymmetrically signed 
```
{ whoami }
```
return an `User!` :
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

return a `String!` which is the CSRF token that must be sent on every request, a refresh token and an access token will be automatically fixed in two cookies

## accessToken
Ask for an access token
* Requires a refresh cookie and a valid CSRF token in the `x-csrf-token` header field

```
{ accessToken }
```
return a `String!` which is a new CSRF token that must be sent on every request, the access token will be automatically updated in a cookie