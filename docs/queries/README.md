# ping
ping the api

```graphql
{
  ping
}
```
## @return
a string: `subscribe to pewdiepie`

---

# cert
```graphql
{
  cert
}
```
## @return
a string: The authentication public key

---

# stage

```graphql
{
  stage {
    stage
    version
  }
}
```

## @return
```graphql
type Stage {
	# dev or prod
	stage: String!
	# x.x.x
	version: String!
}
```

---
# me
!> require to be logged in

who are you ?
```graphql
{
  me {
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
}
```
## @return
```graphql
type User {
	id: ID!
	sessions: [Session!]!
	verified: Boolean!
}
```
```graphql
type Session {
	ip: String!
	browserName: String
	osName: String
	deviceModel: String
	deviceType: String
	deviceVendor: String
}
```

## @throws

| Error | Why |
|-------|-----|
| `COOKIES` | when auth cookies are missing |
| `USER_INCORRECT` | when you doesn't exist |
| `SESSION` | when the session is invalid |