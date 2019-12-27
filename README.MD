![][licence]

<h1 align=center>@hydre/auth</h1>

[![][discord]][discordlink] [![][twitter]][twitterlink]

[licence]: https://img.shields.io/github/license/HydreIO/doubt.svg?style=for-the-badge
[twitter]: https://img.shields.io/badge/follow-us-blue.svg?logo=twitter&style=for-the-badge
[twitterlink]: https://twitter.com/hydreio
[discord]: https://img.shields.io/discord/398114799776694272.svg?logo=discord&style=for-the-badge
[discordlink]: https://discord.gg/bRSpRpD

Serverless Oauth2 compliant authentication for AWS with a GraphQL API

> if you need any help feel free to join the discord above to get a fast reply!

- [How to install](#Setup)
- [Api docs](https://docs.auth.hydre.io/)

# Requirements local

- a mongoDB access (you can use atlas)
- [serverless](https://github.com/serverless/serverless) framework

# Requirements prod

- an AWS account with access to lambda
- some SNS topics `$LABEL:auth:confirm_mail` / `$LABEL:auth:reset_pass` / `${LABEL}:auth:invite_user`
- a mongoDB access (you can use atlas)
- [serverless](https://github.com/serverless/serverless) framework

# Setup

- clone the repo
```
git clone git@github.com:HydreIO/hydre.auth.git
```
- Rename `./serverless.exemple.yml` in `./serverless.yml` (the file become untracked thus you can always pull changes from git while keeping your configuration)
- configure `./serverless.yml`, you'll see some *CHANGE ME: * fields, read the entire file
	> to accept a wildcard cors origin you need to create a custom ressource and disable serverless cors, create an issue if u need more explanation

	> to accept multiple origin replace `origin` by `origins` and input an array
- you can also disable the serverless warmup plugin which is used to keep lambda containers warm

## Usage in development mode
You can access deep logging by setting the env variable `DEBUG` to `auth*`

**__Local testing :__** `AUTH_ENV` set to `development`, that way cookies will be http instead of https and webpack will not minify bundle
Every env variables is defaulted to a value so you can local test out of the box, you only need a `MONGO_URI` (create a free account on mongo atlas and you're set up)

run it with `MONGO_URI="xxx" AUTH_ENV="development" DEBUG="auth*" sls offline` *ignore warnings*

## Usage in production

- deploy the lambda

```
sls deploy
```

Once the auth is online retrieve the endpoint from api gateway in your aws account or in the serverless dashboard in case you linked it.
You'll find any errors logged in cloudwatch logs

# Implementation

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
		"email": "admin@foo.com",
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

# Read more

You'll find more details in the [Api docs](https://docs.auth.hydre.io/) !