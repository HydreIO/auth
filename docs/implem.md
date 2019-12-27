# Implementation details

The auth will fix 2 cookie for you :
- an acces token which expire after 20min, it's the proof you're authenticated. Any server under the specified domain (in `serverless.yml`)
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