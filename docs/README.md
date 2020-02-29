<h1 align=center>@hydre/auth</h1>
<p align=center>
  <img src="https://img.shields.io/github/license/HydreIO/doubt.svg?style=for-the-badge" />
  <a href="https://hub.docker.com/r/hydre/auth">
    <img src="https://img.shields.io/docker/cloud/build/hydre/auth?label=build&logo=docker&style=for-the-badge" />
  </a>
  <a>
    <img src="https://img.shields.io/docker/pulls/hydre/auth?label=pulls&logo=docker&style=for-the-badge">
  </a>
  <a href="https://discord.gg/bRSpRpD">
    <img src="https://img.shields.io/discord/398114799776694272.svg?logo=discord&style=for-the-badge" />
  </a>
</p>

<h3 align=center>A simple and fast authentication server built on KoaJS</h3>

- Graphql API
- Production ready (Almost)
- Support multiple databases
- Highly configurable

Use your favorite database, we currently support

- Mongodb
- Neo4j
- Memgraph
- RedisGraph (can't be used yet as Redisgraph cypher support is not mature enough)

> if you need any help feel free to join the discord above to get a fast reply!

---
# Quickstart

Assuming you run a mongodb instance to `localhost:27017` and you configured your host file to allow
```
127.0.0.1 dev.local
```

- **with Docker 🐋**

```bash
docker run -t \
  -p 3000:3000 \
  -e DEBUG="auth* internal*" \
  -e PORT=3000 \
  -e LOCALHOST=true \
  hydre/auth:mongo-edge
```

- **with Node >= 13.7 ☘️**

```bash
git clone git@github.com:HydreIO/auth.git
cd auth

npm i -g pnpm
pnpm i -r
DEBUG="auth* internal*" PORT=3000 LOCALHOST=true pnpm run start:mongo
```

you can now execute graphql queries against `http://dev.local:3000`

> Don't use this in production as it's configured with default secrets

---
# Configuration

Here are all the main options you can (and should) pass to your env

> All variables are strings

| Variable                | Default value                                       | Description                                                                                                                                                   |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ALLOW_REGISTRATION      | `true`                                              | allowing registration ?                                                                                                                                       |
| GOOGLE_ID               | `xxxx.apps.googleusercontent.com`                   | Oauth2 google app                                                                                                                                             |
| REFRESH_TOKEN_SECRET    | `63959228FC8584C314ETGVC7H2441`                     | 256 bit key                                                                                                                                                   |
| REFRESH_COOKIE_NAME     | `a-cookie-name`                                     | The name of the cookie where the refreshToken will be                                                                                                         |
| ACCESS_COOKIE_NAME      | `another-cookie-name`                               | The name of the cookie where the accessToken will be                                                                                                          |
| COOKIE_DOMAIN           | `dev.local`                                         | the domains for cookies, basically all services with a need to verify authenticated users, authentication need to be under this domain too (subdomains works) |
| PUB_KEY                 | `-----BEGIN EC (check the code)`                    | ES512 public                                                                                                                                                  |
| PRV_KEY                 | `-----BEGIN EC (check the code)`                    | ES512 private                                                                                                                                                 |
| RESET_PASS_DELAY        | `5000`                                              | Delay in milliseconds between 2 reset password query (per user)                                                                                               |
| CONFIRM_ACCOUNT_DELAY   | `5000`                                              | Delay in milliseconds between 2 verification code query (per user)                                                                                            |
| PWD_REGEX               | `'^(?!.*[\s])(?=.*[a-zA-Z])(?=.*[0-9])(?=.{6,32})'` | Enforce password policy                                                                                                                                       |
| EMAIL_REGEX             | Regex (way too long)                                | Enforce mail policy                                                                                                                                           |
| ACCESS_TOKEN_EXPIRATION | `1200000`                                           | Duration in milliseconds of an accessToken validity                                                                                                           |
| LOCALHOST               | `false`                                             | Wether or not the auth is running in local, cookies are https only if the value is false                                                                      |

### Mongodb

| Variable   | Default value               | Description              |
| ---------- | --------------------------- | ------------------------ |
| DATABASE   | `authentication`            | Mongo database name      |
| COLLECTION | `users`                     | Mongo collection name    |
| MONGO_URI  | `mongodb://localhost:27017` | Uri (mongodb+srv) format |

### Bolt (Neoj4 & Memgraph)

| Variable        | Default value           | Description                                             |
| --------------- | ----------------------- | ------------------------------------------------------- |
| BOLT_URI        | `bolt://localhost:7687` | Bolt uri                                                |
| BOLT_USER       | `neo4j`                 | Bolt user (specify an empty string to disable auth)     |
| BOLT_PWD        | `admin`                 | Bolt pwd (specify also an empty string to disable auth) |
| BOLT_ENCRYPTION | `false`                 | SSL                                                     |

### RedisGraph

| Variable   | Default value            | Description                                      |
| ---------- | ------------------------ | ------------------------------------------------ |
| REDIS_URI  | `redis://localhost:6379` | Redis uri                                        |
| GRAPH_NAME | `auth`                   | Name of the graph which will be used by the auth |

---
# How it works

We're fat so we use cookies to send tokens!

The **ACCESS TOKEN** which expire, is the proof you're authenticated.<br>
Any server matching your origins (not as a person but in your configuration)
will receive the token and can verify (`JWT.verify`) it asymmetrically using the authentication public key (see [How to retrieve the public key](https://docs.auth.hydre.io/#/queries/?id=cert))
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
		"mail": "admin@admin.com",
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
> See [here](https://github.com/HydreIO/auth/blob/master/packages/auth-server-core/src/graphql/errors.js) to create your own errors
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
	const { sub: userid, mail, verified } = verifyAccessToken(process.env.AUTH_PUBKEY)(accessToken) || throw new InvalidAccessTokenError()
	Object.assign(ctx, { userid, mail, verified })
	await next()
}
```