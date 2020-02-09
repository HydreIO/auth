# Mutations
You have two types of mutations in the authentication api

## me
this mutation give access to every user related operations like reseting the password
```graphql
type Mutation {
	# me as a human machine
	me: UserOps!
}
```

## authenticate
this one allow to register and login

```graphql
type Mutation {
	# gimme tokens
	authenticate: AuthOps!
}
```
---

# signup
Register an user

- create a session
- create and fix a refresh token
- create and fix an acess token

```graphql
mutation ($creds: Creds!) {
  authenticate {
    signup(creds: $creds) {
      user {
        id
        verified
        sessions {
          ip
          browserName
          osName
          deviceModel
          deviceType
          deviceVendor
        }
      }
      newAccount
      newSession
    }
  }
}
```

```
{
	"creds": {
		"email": "admin@admin.com",
		"pwd": "admin1",
		"rememberMe": true
	}
}
```
## @args

```graphql
input Creds {
	email: String! # The user email
	pwd: String! # The user password
	rememberMe: Boolean # when false the session will expire at the of the navigation
}
```
## @returns
```graphql
type AuthResponse {
	user: User! # the signed user
	newAccount: Boolean! # was it a registration ?
	newSession: Boolean! # was it a non existing session ? usefull to implement security later
}
```
## @throws

| Error                   | Why                                                  |
| ----------------------- | ---------------------------------------------------- |
| `USER_AGENT`            | when the user agent is invalid or not found          |
| `REGISTRATION_DISABLED` | when the registratrion is not allowed                |
| `PWD_FORMAT`            | when the password doesn't respect the allowed format |
| `EMAIL_FORMAT`          | when the email doesn't respect the allowed format    |
| `EMAIL_USED`            | when the email is already used                       |

---

# signin
Check the user credentials and log the user in

- create and fix a new access token
- retrieve or create a session with the corresponding refresh
- fix the refresh token

```graphql
mutation ($creds: Creds!) {
  authenticate {
    signin(creds: $creds) {
      user {
        id
        verified
        sessions {
          ip
          browserName
          osName
          deviceModel
          deviceType
          deviceVendor
        }
      }
      newAccount
      newSession
    }
  }
}
```
```
{
	"creds": {
		"email": "admin@admin.com",
		"pwd": "admin1",
		"rememberMe": true
	}
}
```
## @args
```graphql
input Creds {
	email: String!
	pwd: String!
	rememberMe: Boolean
}
```
## @returns
```graphql
type AuthResponse {
	user: User! # the signed user
	newAccount: Boolean! # was it a registration ?
	newSession: Boolean! # was it a non existing session ? usefull to implement security later
}
```
## @throws

| Error            | Why                                                  |
| ---------------- | ---------------------------------------------------- |
| `USER_AGENT`     | when the user agent is invalid or not found          |
| `USER_INCORRECT` | when the credentials doesn't match any user          |
| `PWD_FORMAT`     | when the password doesn't respect the allowed format |
| `EMAIL_FORMAT`   | when the email doesn't respect the allowed format    |

---

# sign
Register or log the user against his Oauth provider

- create and fix a new access token
- retrieve or create a session with the corresponding refresh token
- fix the refresh token

```graphql
mutation ($provider: Provider!, $idToken: String!) {
  authenticate {
    sign(provider: $provider, idToken: $idToken) {
      user {
        id
        verified
        sessions {
          ip
          browserName
          osName
          deviceModel
          deviceType
          deviceVendor
        }
      }
      newAccount
      newSession
    }
  }
}
```
```
{
	"provider": "GOOGLE",
	"idToken": ""
}
```
## @args

An enum, [GOOGLE | ...] (only google is supported at the time of writing)
```
provider: Provider!
```
The token you get from the provider auth screen (link ?)
```
idToken: String!
```
## @returns
```graphql
type AuthResponse {
	user: User! # the signed user
	newAccount: Boolean! # was it a registration ?
	newSession: Boolean! # was it a non existing session ? usefull to implement security later
}
```
## @throws

| Error                      | Why                                                    |
| -------------------------- | ------------------------------------------------------ |
| `USER_AGENT`               | when the user agent is invalid or not found            |
| `REGISTRATION_DISABLED`    | when the registratrion is not allowed                  |
| `UNKNOW_PROVIDER`          | when the provider is not supported or incorrect        |
| `GOOGLE_TOKEN`             | when there is something wrong with the google id token |
| `GOOGLE_ID`                | when the google id is not found (provider error)       |
| `GOOGLE_EMAIL_NOT_GRANTED` | when when the google email is not granted              |

---

# signout
!> require to be logged in
Sign out the user by removing all cookies

```graphql
mutation {
  authenticate {
    signout
  }
}
```
## @return
a string: `Bye!`
## @throws

| Error            | Why                                           |
| ---------------- | --------------------------------------------- |
| `COOKIES`        | when cookies are not found                    |
| `USER_AGENT`     | when the user agent is invalid or not found   |
| `USER_INCORRECT` | when the user is not found                    |
| `SESSION`        | when the session doesn't exist or was revoked |

---

# refresh
generate a new accessToken and store it in a cookie
```graphql
mutation {
  me {
    refresh
  }
}
```
## @return
a string: `And you're full of gas!`

## @throws

| Error            | Why                                           |
| ---------------- | --------------------------------------------- |
| `COOKIES`        | when auth cookies are missing                 |
| `USER_INCORRECT` | when you doesn't exist :shrug:                |
| `SESSION`        | when the session is invalid                   |
| `REFRESH_TOKEN`  | when refresh token is invalid for the session |

---

# sendCode
Ask a code to perform different actions and then notify SNS topics below

- **CONFIRM_EMAIL**: `${LABEL}:auth:confirm_mail` will be notified
- **RESET_PWD**: `${LABEL}:auth:reset_pass` wil be notified

> The auth doesn't say anything in case the email doesn't correspond to any account

```graphql
mutation ($email: String!) {
  me {
    pwd: sendCode(code: RESET_PWD, email: $email)
    verify: sendCode(code: CONFIRM_EMAIL, email: $email)
  }
}
```
```
{
	"email": "admin@admin.com"
}
```
## @args
The code enum type `['CONFIRM_EMAIL', 'RESET_PWD']`
```
code: Code!
```
The user email
```
email: String!
```
## @return
`Bip bop! code sent (or not)`

## @throws

| Error          | Why                                 |
| -------------- | ----------------------------------- |
| `SPAM`         | Wow slow down Barry Allen           |
| `UNKNOW_CODE`  | When the code type is not supported |
| `EMAIL_FORMAT` | when the email format is invalid    |

---

# inviteUser
Create an account for someone and notify SNS topic `${LABEL}:auth:invite_user`

```graphql
mutation {
  me {
    inviteUser(email: "some@normy.dude")
  }
}
```
## @args
```
email: String!
```

## @return
The JWT `{ invitedId, email }` of the invited user, or `null` if already exist

## @throws

| Error            | Why                              |
| ---------------- | -------------------------------- |
| `COOKIES`        | when auth cookies are missing    |
| `USER_INCORRECT` | when you doesn't exist :shrug:   |
| `SPAM`           | Wow slow down Barry Allen        |
| `SESSION`        | when the session is invalid      |
| `EMAIL_FORMAT`   | when the email format is invalid |

---

# confirmEmail
confirm the user account
> The auth doesn't say anything in case the email doesn't correspond to any account

```graphql
mutation {
  me {
    confirmEmail(email: "admin@admin.com", code: "xxxx")
  }
}
```
## @args
The user email
```
email: String!
```

The code was sent by email by the `sendCode` query
```
code: String!
```

## @return
a string: `You're one with the force`

## @throws

| Error                       | Why                                                   |
| --------------------------- | ----------------------------------------------------- |
| `VERIFICATION_CODE_INVALID` | when the verification code is invalid or already used |
| `EMAIL_FORMAT`              | when the email format is invalid                      |

---

# resetPassword
Reset the user password
> The auth doesn't say anything in case the email doesn't correspond to any account

```graphql
mutation {
  me {
    resetPassword(email: "admin@admin.com", newPwd: "admin1", resetCode: "xxxxx")
  }
}
```
## @args
The user email
```
email: String!
```
The user new password
```
newPwd: String!
```
The emailed reset code
```
resetCode: String!
```
## @return
`A fresh new start!`

## @throws

| Error                | Why                                                  |
| -------------------- | ---------------------------------------------------- |
| `PWD_FORMAT`         | when the password doesn't respect the allowed format |
| `RESET_CODE_INVALID` | when the reset code is invalid or already used       |
| `EMAIL_FORMAT`       | when the email format is invalid                     |