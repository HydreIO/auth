![][licence]

<h1 align=center>@hydre/auth</h1>

[![][discord]][discordlink] [![][twitter]][twitterlink]

[licence]: https://img.shields.io/github/license/HydreIO/doubt.svg?style=for-the-badge
[twitter]: https://img.shields.io/badge/follow-us-blue.svg?logo=twitter&style=for-the-badge
[twitterlink]: https://twitter.com/hydreio
[discord]: https://img.shields.io/discord/398114799776694272.svg?logo=discord&style=for-the-badge
[discordlink]: https://discord.gg/bRSpRpD

Serverless authentication built on GraphQL for AWS Lambda

> if you need any help feel free to join the discord above to get a fast reply!

**__Navigation__**

* [Home](/)
  * [Requirements](requirements.md)
    * [Locally](requirements.md#Locally)
    * [Production](requirements.md#Production)
  * [Setup](setup.md)
  * [Usage](usage.md)
    * [Usage in development mode](usage.md#Usage-in-development-mode)
    * [Usage in production](usage.md#Usage-in-production)
  * [Implementation](implem.md)
    * [Implementation details](implem.md#Implementation-details)
    * [Server verification](implem.md#Server-verification)
    * [Flow](implem.md#Flow)
    * [Errors handling](implem.md#errors-handling)
* [Queries](queries/)
  * [ping](queries/#ping)
  * [cert](queries/#cert)
  * [stage](queries/#stage)
  * [me](queries/#me)
* [Mutations](mutations/)
  * [signup](mutations/#signup)
  * [signin](mutations/#signin)
  * [sign](mutations/#sign)
  * [signout](mutations/#signout)
  * [refresh](mutations/#refresh)
  * [sendCode](mutations/#sendCode)
  * [inviteUser](mutations/#inviteUser)
  * [confirmEmail](mutations/#confirmEmail)
  * [resetPassword](mutations/#resetPassword)

# Implementation details

The auth will fix 2 cookie for you :
- an acces token which expire, it's the proof you're authenticated. Any server matching configurated origins
will receive the token and can verify (`JWT.verify`) it asymmetrically with the authentication public key (see [How to retrieve the public key](https://docs.auth.hydre.io/#/cert))
if the token is valid then you can trust the request

- a refresh token, only used by the auth to fix new accessTokens

Make sure you know how cookies work, the `domain` must be your services domain, for exemple if you have

- auth.foo.com
- myapp.foo.com
- api.foo.com

the `domain` field must be `.foo.com`, you cannot have different domains.

## Flow

Start by registering an account
```graphql
mutation ($creds: Creds!) {
  authenticate {
    signup(creds: $creds) {
      user { id }
    }
  }
}
```
Variables :
```json
{
	"creds": {
		"email": "admin@admin.com",
		"pwd": "admin1",
		"rememberMe": true
	}
}
```

Try to refresh it
```graphql
mutation {
  me {
    refresh
  }
}
```

Ask who you are
```graphql
{
  me {
    id
    verified
    sessions {
      ip
    }
  }
}
```

Then leave
> Calling signout remove the cookies, it's mandatory
```graphql
mutation {
  authenticate {
    signout
  }
}
```

## Server verification
Dead simple exemple of an auth middleware with koaJs
```js
import jwt from 'jsonwebtoken'

const verifyAccessToken = publicKey => token => {
	try {
		return jwt.verify(token, publicKey, {
			algorithms: 'ES512',
			issuer: 'auth.service'
		})
	} catch (e) {
		console.error(e)
	}
}


export const auth = async (ctx, next) => {
	const accessToken = ctx.cookies.get(ctx.COOKIE_NAME) || throw new CookiesMissingError()
	const { sub: userid, email, verified } = verifyAccessToken(ctx.AUTH_PUBKEY)(accessToken) || throw new InvalidAccessTokenError()
	Object.assign(ctx, { userid, email, verified })
	await next()
}
```

## errors handling

Working with graphql you'll get two type of errors, `graphQLErrors` and `networkErrors`.
A graphql errors is returned as
```js
[{"errors":[{"message":"User not found","type":"USER_INCORRECT"}],"data":null}]
```

I suggest using [apollo-link-error](https://www.npmjs.com/package/apollo-link-error) as so

```js
import { Observable } from 'apollo-link'
import { onError } from 'apollo-link-error'

const onGraphqlError = async ({ graphQLErrors = [], observer, operation, forward }) => {
  // here you could call the refresh query in case you receive an expired error
  for (let error of graphQLErrors)
    observer.next(forward(operation)) // this line would retry the operation
}

const onNetworkError = async ({ observer, networkError, operation, forward }) => { }

export const errorHandler = opt => new Observable(async observer => {
  try {
    const payload = { ...opt, observer }
    await Promise.all([onGraphqlError(payload), onNetworkError(payload)])
    if (observer.closed) return
    observer.complete()
  } catch (error) {
    observer.error(error)
  }
})
```