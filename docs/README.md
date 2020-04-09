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

Docker tags:

- `hydre/auth:edge-mongo`
- `hydre/auth:<version>-mongo`
- `hydre/auth:edge-dgraph`
- `hydre/auth:<version>-dgraph`
- `hydre/auth:edge-bolt` (neo4j & memgraph)
- `hydre/auth:<version>-bolt`

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
  --network host \
  hydre/auth:edge-mongo
```

- **with Node >= 13.7 ☘️**

```bash
git clone git@github.com:HydreIO/auth.git
cd auth

npm i -g pnpm
npm run install:all
DEBUG="auth* internal*" PORT=3000 LOCALHOST=true npm run start:mongo

# For a more advanced configuration
npm i -g dotenv-cli
touch .env
dotenv -- npm run start:mongo
```

you can now execute graphql queries against `http://dev.local:3000`

> Don't use this in production as it's configured with default secrets

---
# Configuration

Here are all the main options you can (and should) pass to your env

> All variables are strings

| Variable                | Default value                                       | Description                                                                                                                                                   |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PORT                    | `3000`                                              | the server port                                                                                                                                               |
| ALLOW_REGISTRATION      | `true`                                              | allowing registration ?                                                                                                                                       |
| GOOGLE_ID               | `xxxx.apps.googleusercontent.com`                   | Oauth2 google app                                                                                                                                             |
| REFRESH_TOKEN_SECRET    | `63959228FC8584C314ETGVC7H2441`                     | 256 bit key                                                                                                                                                   |
| REFRESH_COOKIE_NAME     | `a-cookie-name`                                     | The name of the cookie where the refreshToken will be                                                                                                         |
| ACCESS_COOKIE_NAME      | `another-cookie-name`                               | The name of the cookie where the accessToken will be                                                                                                          |
| COOKIE_DOMAIN           | `dev.local`                                         | the domains for cookies, basically all services with a need to verify authenticated users, authentication need to be under this domain too (subdomains works) |
| PUB_KEY                 | `-----BEGIN EC (check the code)`                    | ES512 public                                                                                                                                                  |
| PRV_KEY                 | `-----BEGIN EC (check the code)`                    | ES512 private                                                                                                                                                 |
| RESET_PASS_DELAY        | `5s`                                                | Delay between 2 reset password query (per user) @see https://github.com/zeit/ms                                                                               |
| CONFIRM_ACCOUNT_DELAY   | `5s`                                                | Delay between 2 verification code query (per user) @see https://github.com/zeit/ms                                                                            |
| INVITE_USER_DELAY       | `5s`                                                | Delay between 2 user invitation query (per user) @see https://github.com/zeit/ms                                                                            |
| PWD_REGEX               | `'^(?!.*[\s])(?=.*[a-zA-Z])(?=.*[0-9])(?=.{6,32})'` | Enforce password policy                                                                                                                                       |
| EMAIL_REGEX             | Regex (way too long)                                | Enforce mail policy                                                                                                                                           |
| ACCESS_TOKEN_EXPIRATION | `20m`                                               | Duration in milliseconds of an accessToken validity                                                                                                           |
| LOCALHOST               | `false`                                             | Wether or not the auth is running in local, cookies are https only if the value is false                                                                      |
| SOCKET_NOTIFIER_ADDRESS | `tcp://0.0.0.0:3001`                                | ZeroMQ will bind here to send datas like password_reset etc.. (see [server usage](#server-usage))                                                             |
| SOCKET_HEALTH_ADDRESS   | `tcp://0.0.0.0:3002`                                | ZeroMQ will bind here to provide a tcp health check endpoint (mainly for kubernetes)                                                                          |
| ORIGINS                 | `*`                                                 | Cors accepted origin regex, ex: to support `*.foo.bar` and `*.bar.baz` you can use `ORIGINS=".+\.foo\.bar;.+\.bar\.baz"`                                      |
| GRAPHQL_PATH            | `/`                                                 | the query path, usually default to `/graphql`                                                                                                                 |

### Mongodb

| Variable   | Default value               | Description                      |
| ---------- | --------------------------- | -------------------------------- |
| DATABASE   | `authentication`            | Mongo database name              |
| COLLECTION | `users`                     | Mongo collection name            |
| MONGO_URI  | `mongodb://localhost:27017` | Uri (mongodb+srv) format         |
| RETRIES    | `5`                         | max connection retries at launch |

### Dgraph

| Variable       | Default value    | Description                                                                                          |
| -------------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| DGRAPH_RPC_URI | `localhost:9080` | Dgraph alpha uri (actually no support for multiple endpoint yet as it was first made for kubernetes) |
| RETRIES        | `10`             | max connection retries at launch (exponentials with 500ms initial)                                   |

The auth will not manage the dgraph schema for you as it would conflict with your others service, here is what you need to allow in order for this package to work

```graphql
type user {
  uuid
  mail
  hash
  verified
  verificationCode
  lastInvitationSent
  sessions
}

type session {
  ip
  browserName
  osName
  deviceModel
  deviceType
  deviceVendor
  refreshToken
  hash
}

uuid: string @index(exact) @upsert .
mail: string @index(exact) @upsert .
hash: string .
verified: bool .
verificationCode: string .
lastInvitationSent: float .
sessions: [uid] .
ip: string .
browserName: string .
osName: string .
deviceModel: string .
deviceType: string .
deviceVendor: string .
refreshToken: string .
```

### Bolt (Neoj4 & Memgraph)

| Variable        | Default value           | Description                                                        |
| --------------- | ----------------------- | ------------------------------------------------------------------ |
| BOLT_URI        | `bolt://localhost:7687` | Bolt uri                                                           |
| BOLT_USER       | ``                      | Bolt user (empty string to disable auth)                           |
| BOLT_PWD        | ``                      | Bolt pwd (empty string to disable auth)                            |
| BOLT_ENCRYPTION | `false`                 | SSL                                                                |
| RETRIES         | `10`                    | max connection retries at launch (exponentials with 500ms initial) |

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

## Listen for ZeroMQ events

The auth server doesn't implement email sending nor external computation. Instead it send you a msg over a configurablesocket binding.

Here is a simple exemple on how to receive those messages and distribute them randomly against 3 workers

```js
import zmq from 'zeromq'
import Debug from 'debug'

const debug = Debug('worker')
const socketAddress = 'tcp://127.0.0.1:3001'

class Worker {
  constructor(name) {
    this.sock = new zmq.Pull
    this.log = debug.extend(name)
  }

  async listen(socketAddress) {
    this.sock.connect(socketAddress)
    this.log('is online!')
    for await (const [key, ...rest] of this.sock) {
      const datas = rest.map(v => v.toString())
      switch (key.toString()) {
        case 'INVITE_USER':
          const [from, to, code] = datas
          break
        case 'CONFIRM_EMAIL':
          const [to, code] = datas
          break
        case 'RESET_PWD':
          const [to, code] = datas
          break
      }

    }
    this.log('is offline...')
  }
}

void async function() {
  const workers = [new Worker('A'), new Worker('B'), new Worker('C')]
  await Promise.all(workers.map(w => w.listen()))
}()
```

They possible keys are :

- `INVITE_USER` which notify that you should send an email to the invited user to welcome him
  - `from` is the mail of the personne who invited the user
  - `to` is the invited user mail
  - `code` is the reset code of the invited user
- `CONFIRM_EMAIL` which notify that you should send an email to the user allowing him to confirm his email
  - `to` is the user mail
  - `code` is the confirm code of the user
- `RESET_PWD` which notify that you should send an email to the user allowing him to reset his pwd
  - `to` is the user mail
  - `code` is the reset code of the user