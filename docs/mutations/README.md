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
        uuid
        mail
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
		"mail": "admin@admin.com",
		"pwd": "admin1",
		"rememberMe": true
	}
}
```

## @args

```graphql
input Creds {
  mail: String! # The user mail
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

| Error                   | Error string                                  | Why                                                  |
| ----------------------- | --------------------------------------------- | ---------------------------------------------------- |
| `USER_AGENT`            | `The user agent is invalid`                   | when the user agent is invalid or not found          |
| `REGISTRATION_DISABLED` | `Registrations are currently disabled`        | when the registratrion is not allowed                |
| `PWD_FORMAT`            | `Incorrect password format`                   | when the password doesn't respect the allowed format |
| `EMAIL_FORMAT`          | `Incorrect mail format`                       | when the mail doesn't respect the allowed format     |
| `EMAIL_USED`            | `The mail address ${mail} is already in use.` | when the mail is already used                        |

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
        uuid
        mail
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
		"mail": "admin@admin.com",
		"pwd": "admin1",
		"rememberMe": true
	}
}
```

## @args

```graphql
input Creds {
  mail: String!
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

| Error            | Error string                | Why                                                  |
| ---------------- | --------------------------- | ---------------------------------------------------- |
| `USER_AGENT`     | `The user agent is invalid` | when the user agent is invalid or not found          |
| `USER_INCORRECT` | `User not found`            | when the credentials doesn't match any user          |
| `PWD_FORMAT`     | `Incorrect password format` | when the password doesn't respect the allowed format |
| `EMAIL_FORMAT`   | `Incorrect mail format`     | when the mail doesn't respect the allowed format     |

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
        uuid
        mail
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

| Error                      | Error string                                                      | Why                                                    |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| `USER_AGENT`               | `The user agent is invalid`                                       | when the user agent is invalid or not found            |
| `REGISTRATION_DISABLED`    | `Registrations are currently disabled`                            | when the registratrion is not allowed                  |
| `UNKNOW_PROVIDER`          | `The provider ${provider} is not implemented`                     | when the provider is not supported or incorrect        |
| `GOOGLE_TOKEN`             | `Google idToken invalid`                                          | when there is something wrong with the google id token |
| `GOOGLE_ID`                | `Google user id not found`                                        | when the google id is not found (provider error)       |
| `GOOGLE_EMAIL_NOT_GRANTED` | `Google user mail not found, app need to grant access in request` | when when the google mail is not granted               |

---

# signout

Sign out the user by removing all cookies

> also remove the session if the user is logged

```graphql
mutation {
  authenticate {
    signout
  }
}
```

## @return

a string: `Bye.`

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

| Error            | Error string                                            | Why                                           |
| ---------------- | ------------------------------------------------------- | --------------------------------------------- |
| `USER_AGENT`     | `The user agent is invalid`                             | when the user agent is invalid or not found   |
| `COOKIES`        | `Cookies are invalid or missing`                        | when auth cookies are missing                 |
| `USER_INCORRECT` | `User not found`                                        | when you doesn't exist                        |
| `SESSION`        | `The session doesn't exist, is expired, or was revoked` | when the session is invalid                   |
| `REFRESH_TOKEN`  | `The refresh token is invalid`                          | when refresh token is invalid for the session |

---

# sendCode

Ask a code to perform different actions and then send a zmq socket message

- **CONFIRM_EMAIL**: `['CONFIRM_EMAIL', 'TO', 'CODE']` will be notified
- **RESET_PWD**: `['RESET_PWD', 'TO', 'CODE']` wil be notified

> The auth doesn't say anything in case the mail doesn't correspond to any account

```graphql
mutation ($mail: String!) {
  me {
    pwd: sendCode(code: RESET_PWD, mail: $mail)
    verify: sendCode(code: CONFIRM_EMAIL, mail: $mail)
  }
}
```

```
{
	"mail": "admin@admin.com"
}
```

## @args

The code enum type `['CONFIRM_EMAIL', 'RESET_PWD']`

```
code: Code!
```

The user mail

```
mail: String!
```

## @return

`Bip bop! code sent (or not)`

## @throws

| Error                | Error string                                        | Why                                 |
| -------------------- | --------------------------------------------------- | ----------------------------------- |
| `SPAM`               | `This request is protected against spam`            | Wow slow down Barry Allen           |
| `UNKNOW_CODE`        | `This code doesn't exist`                           | When the code type is not supported |
| `EMAIL_FORMAT`       | `Incorrect mail format`                             | when the mail format is invalid     |
| `MAIL_SENDING_ERROR` | `Mail service is unreachable, can't send any mails` | when the mail could not be sent     |

---

# inviteUser

Create an account for someone and then send a zmq socket message

- **CONFIRM_EMAIL**: `['INVITE_USER', 'TO', 'CODE']` will be notified

```graphql
mutation {
  me {
    inviteUser(mail: "some@normy.dude")
  }
}
```

## @args

```
mail: String!
```

## @return

The JWT `{ invitedId, mail }` of the invited user, or `null` if already exist

## @throws

| Error                | Error string                                            | Why                             |
| -------------------- | ------------------------------------------------------- | ------------------------------- |
| `COOKIES`            | `Cookies are invalid or missing`                        | when auth cookies are missing   |
| `USER_INCORRECT`     | `User not found`                                        | when you doesn't exist          |
| `SPAM`               | `This request is protected against spam`                | Wow slow down Barry Allen       |
| `SESSION`            | `The session doesn't exist, is expired, or was revoked` | when the session is invalid     |
| `EMAIL_FORMAT`       | `Incorrect mail format`                                 | when the mail format is invalid |
| `MAIL_SENDING_ERROR` | `Mail service is unreachable, can't send any mails`     | when the mail could not be sent |

---

# confirmMail

confirm the user account

> The auth doesn't say anything in case the mail doesn't correspond to any account

```graphql
mutation {
  me {
    confirmMail(mail: "admin@admin.com", code: "xxxx")
  }
}
```

## @args

The user mail

```
mail: String!
```

The code was sent by mail by the `sendCode` query

```
code: String!
```

## @return

a string: `You're one with the force`

## @throws

| Error                       | Error string              | Why                                                   |
| --------------------------- | ------------------------- | ----------------------------------------------------- |
| `VERIFICATION_CODE_INVALID` | `This code doesn't exist` | when the verification code is invalid or already used |
| `EMAIL_FORMAT`              | `Incorrect mail format`   | when the mail format is invalid                       |

---

# resetPassword

Reset the user password

> The auth doesn't say anything in case the mail doesn't correspond to any account

```graphql
mutation {
  me {
    resetPassword(mail: "admin@admin.com", newPwd: "admin1", resetCode: "xxxxx")
  }
}
```

## @args

The user mail

```
mail: String!
```

The user new password

```
newPwd: String!
```

The mailed reset code

```
resetCode: String!
```

## @return

`A fresh new start!`

## @throws

| Error                | Error string                | Why                                                  |
| -------------------- | --------------------------- | ---------------------------------------------------- |
| `PWD_FORMAT`         | `Incorrect password format` | when the password doesn't respect the allowed format |
| `RESET_CODE_INVALID` | `The reset code is invalid` | when the reset code is invalid or already used       |
| `EMAIL_FORMAT`       | `Incorrect mail format`     | when the mail format is invalid                      |
