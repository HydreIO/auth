![][licence] [![][forks]][repolink]

<h1 class="test" align=center>@hydre/auth</h1>

[![][discord]][discordlink] [![][twitter]][twitterlink]

[licence]: https://img.shields.io/github/license/HydreIO/doubt.svg?style=for-the-badge
[twitter]: https://img.shields.io/badge/follow-us-blue.svg?logo=twitter&style=for-the-badge
[twitterlink]: https://twitter.com/hydreio
[discord]: https://img.shields.io/discord/398114799776694272.svg?logo=discord&style=for-the-badge
[discordlink]: https://discord.gg/bRSpRpD
[forks]: https://img.shields.io/github/forks/HydreIO/hydre.auth?label=fork%20me&logo=github&style=for-the-badge
[repolink]: https://github.com/HydreIO/hydre.auth

Lightweight authentication server built on GraphQL

> if you need any help feel free to join the discord above to get a fast reply!

# Quick Start

```
git clone git@github.com:HydreIO/hydre.auth.git
cd hydre.auth/packages/auth-<integration>
touch .env
```
Test it locally by fill the `.env` file according to the chosen `integration`
```
DEBUG="auth* internal*" LOCALHOST="true" npm run dev
```
> By specifying LOCALHOST we allow cookies to be unsecure (http)

- [**Koa**](koa/)
- [**Lambda**](lambda/)

---

# How it works

We're fat so we use cookies to send tokens!

The **ACCESS TOKEN** which expire, is the proof you're authenticated.<br>
Any server matching your origins (not as a person but in your configuration)
will receive the token and can verify (`JWT.verify`) it asymmetrically using the authentication public key (see [How to retrieve the public key](https://docs.auth.hydre.io/#/queries#cert))
if the token is valid then you can trust the request

The **REFRESH TOKEN** which doesn't expire but can be revoked, is only used by the auth to send new accessTokens

Make sure you know how cookies work, the `domain` must be your services domain, for exemple if you have

- auth.foo.com
- myapp.foo.com
- api.foo.com

the `domain` field must be `.foo.com`, you cannot have different domains.<br>
when running the auth in local you must add some kind of domain to your hosts file like
```
127.0.0.1 local.host
```
and specify `local.host` as the `domain`.<br>
while you can wildcard the `ORIGINS`, we advise to set it according to your needs
```
ORIGINS="http:\/\/local.host:.+"
```
that way you can connect through any service running locally, like a vue App `http://local.host:8080`

---

# Client Usage

#### Start by registering an account
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

#### Try to refresh it
```graphql
mutation {
  me {
    refresh
  }
}
```

#### Ask who you are
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

#### Then leave
> Calling signout remove the cookies, it's mandatory
```graphql
mutation {
  authenticate {
    signout
  }
}
```

---

# Client Error Handling

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

---

# Server Usage
Dead simple exemple of an auth middleware with koaJs
> See [here](https://github.com/HydreIO/hydre.auth/blob/master/packages/auth-core/graphql/errors.js) to create your own errors
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
	const accessToken = ctx.cookies.get(process.env.ACCESS_TOKEN_COOKIE_NAME) || throw new CookiesMissingError()
	const { sub: userid, email, verified } = verifyAccessToken(process.env.AUTH_PUBKEY)(accessToken) || throw new InvalidAccessTokenError()
	Object.assign(ctx, { userid, email, verified })
	await next()
}
```