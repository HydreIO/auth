# Usage in development mode
You can access deep logging by setting the env variable `DEBUG` to `auth*`

**__Local testing :__** `AUTH_ENV` set to `development`, that way cookies will be http instead of https and webpack will not minify bundle
Every env variables is defaulted to a value so you can local test out of the box, you only need a `MONGO_URI` (create a free account on mongo atlas and you're set up)

run it with `MONGO_URI="xxx" AUTH_ENV="development" DEBUG="auth*" sls offline` *ignore warnings*

# Usage in production

- deploy the lambda

```
sls deploy
```

Once the auth is online retrieve the endpoint from api gateway in your aws account or in the serverless dashboard in case you linked it.
You'll find any errors logged in cloudwatch logs