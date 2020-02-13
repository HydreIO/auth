# Requirements
- None
---

# Environement

> All variables are strings

| Variable                  | Value                             | Description                                                                                                                                                   |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALLOW_REGISTRATION`      | `true` `false`                    | allowing registration ? those values can always be changed in the lambda settings on the aws dashboard                                                        |
| `GOOGLE_ID`               | `xxxx.apps.googleusercontent.com` | Oauth2 google app                                                                                                                                             |
| `REFRESH_TOKEN_SECRET`    | `63959228FC8584C314ETGVC7H2441`   | 256 bit key                                                                                                                                                   |
| `REFRESH_COOKIE_NAME`     | `a-cookie-name`                   | The name of the cookie where the refreshToken will be                                                                                                         |
| `ACCESS_COOKIE_NAME`      | `another-cookie-name`             | The name of the cookie where the accessToken will be                                                                                                          |
| `COOKIE_DOMAIN`           | `.exemple.com`                    | the domains for cookies, basically all services with a need to verify authenticated users, authentication need to be under this domain too (subdomains works) |
| `PUB_KEY`                 | `-----BEGIN EC`                   | ES512 public                                                                                                                                                  |
| `PRV_KEY`                 | `-----BEGIN EC`                   | ES512 private                                                                                                                                                 |
| `RESET_PASS_DELAY`        | `5000`                            | Delay in milliseconds between 2 reset password query (per user)                                                                                               |
| `CONFIRM_ACCOUNT_DELAY`   | `5000`                            | Delay in milliseconds between 2 verification code query (per user)                                                                                            |
| `PWD_REGEX`               | Regex                             | Enforce password policy                                                                                                                                       |
| `EMAIL_REGEX`             | Regex                             | Enforce mail policy                                                                                                                                           |
| `ACCESS_TOKEN_EXPIRATION` | `1200000`                         | Duration in milliseconds of an accessToken validity                                                                                                           |
| `LOCALHOST`               | `true` `false`                    | Wether or not the auth is running in local, cookies are https only and webpack minify the bundle if the value is false                                        |

Type of datasource used

| Variable   | Value           | Description             |
| ---------- | --------------- | ----------------------- |
| DATASOURCE | `MONGO` `NEO4J` | Use a specific database |

Using **__MongoDB:__**

| Variable   | Value                                     | Description           |
| ---------- | ----------------------------------------- | --------------------- |
| DATABASE   | `auth`                                    | Mongo database name   |
| COLLECTION | `users`                                   | Mongo collection name |
| MONGO_URI  | `mongodb+srv://[username:password@]host/` | Uri format            |

# Setup

* Initialize

```
git clone git@github.com:HydreIO/hydre.auth.git
cd hydre.auth/packages/auth-koa
touch .env
```

- Fill the env file with enough variables and run

```
DEBUG="auth* internal*" npm run dev
```

- Build for production

```
npm run build
npm run start
```