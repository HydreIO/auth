<h1 align=center>@hydre/auth</h1>
<p align=center>
  <img src="https://img.shields.io/github/license/HydreIO/auth.svg?style=for-the-badge" />
  <a href="https://hub.docker.com/r/hydre/auth">
    <img src="https://img.shields.io/docker/pulls/hydre/auth?label=pulls&logo=docker&style=for-the-badge" />
  </a>
  <a href="https://discord.gg/bRSpRpD">
    <img src="https://img.shields.io/discord/398114799776694272.svg?logo=discord&style=for-the-badge" />
  </a>
</p>

<h3 align=center>A production-ready GraphQL authentication server built on Redis JSON</h3>

Modern, lightweight authentication microservice with JWT tokens, session management, and comprehensive test coverage. Fully updated for 2025 standards with Node v25 compatibility.

## ✨ Features

- 🔐 **JWT Authentication** - ES512 (ECDSA P-521 + SHA-512) tokens via [jose](https://github.com/panva/jose)
- 🗄️ **Redis JSON Storage** - Fast, schema-less user and session data
- 🔄 **Session Management** - Multi-device support with session refresh and revocation
- 📧 **Email Verification** - Account confirmation with time-limited codes
- 🔑 **Password Reset** - Secure reset flow with rate limiting
- 👥 **User Invitations** - Passwordless invite system
- 🛡️ **Security** - bcrypt hashing, rate limiting, CORS, cookie security
- 🧪 **Test Coverage** - 87.63% statements, 76.19% functions (node:test + c8)
- 🚀 **Production Ready** - Docker support, Redis Sentinel, comprehensive error handling

## 🏗️ Architecture

**Tech Stack:**
- [Koa](https://koajs.com/) - Web framework
- [@hydre/graphql-http](https://github.com/HydreIO/graphql-http) - GraphQL server
- [Redis JSON](https://redis.io/docs/stack/json/) - Data storage
- [jose](https://github.com/panva/jose) - JWT signing and verification
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) - Password hashing
- [ZeroMQ](https://zeromq.org/) - Email notifications (optional)

**Data Model:**
- **Users**: Stored as JSON documents with email (indexed), password hash, verification status
- **Sessions**: Device-specific sessions with refresh tokens, user agent tracking
- **Tokens**: Short-lived JWTs (20min default) with refresh capability

## 📦 Installation

```bash
npm install @hydre/auth
```

### Development Setup

```bash
# Clone repository
git clone https://github.com/HydreIO/auth.git
cd auth

# Install dependencies
npm install

# Start Redis (via Docker)
docker compose up -d

# Run server
npm start
```

## ⚙️ Configuration

Configure via environment variables:

### Required

```bash
# Cryptographic Keys (PKCS#8 format for jose)
PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

**Generate keys:**
```bash
# ES512 (ECDSA P-521)
openssl ecparam -genkey -name secp521r1 -noout | openssl pkcs8 -topk8 -nocrypt
```

### Optional

```bash
# Server
PORT=3000
GRAPHQL_PATH=/
SERVER_HOST=localhost

# Redis
REDIS_HOST=localhost
REDIS_USE_SENTINEL=false           # Enable for production
REDIS_SENTINEL_PORT=26379
REDIS_MASTER_NAME=mymaster

# JWT
JWT_ISSUER=hydre-auth
JWT_AUDIENCE=hydre-services
ACCESS_TOKEN_EXPIRATION=20m
CONFIRM_ACCOUNT_TOKEN_EXPIRATION=1d

# Cookies
COOKIE_SECURE=true                 # HTTPS only
COOKIE_SAMESITE=Lax
COOKIE_DOMAIN=.example.com
COOKIE_PATH=/
ACCESS_TOKEN_COOKIE_NAME=virtual-fox

# Security
BCRYPT_ROUNDS=12
MAX_SESSION_PER_USER=10
ALLOW_REGISTRATION=true

# Rate Limiting
RESET_PASS_DELAY=5000             # 5 seconds between password resets
CONFIRM_ACCOUNT_DELAY=5000        # 5 seconds between confirmation codes

# Notifications (optional)
SOCKET_NOTIFIER_ADDRESS=tcp://0.0.0.0:3001

# CORS
ORIGINS=.*                        # Semicolon-separated regex patterns
```

## 🚀 Usage

### GraphQL API

**Create User:**
```graphql
mutation {
  create_user(
    mail: "user@example.com"
    pwd: "secure123"
    lang: EN
  )
}
```

**Login:**
```graphql
mutation {
  create_session(
    mail: "user@example.com"
    pwd: "secure123"
    remember: true
  )
}
```

**Get Current User:**
```graphql
query {
  me {
    mail
    verified
    member_since
  }
}
```

**Refresh Token:**
```graphql
mutation {
  refresh_session
}
```

**Logout:**
```graphql
mutation {
  delete_session
}
```

**Confirm Account:**
```graphql
mutation {
  confirm_account(code: "jwt-code-from-email")
}
```

**Password Reset:**
```graphql
mutation {
  # Request reset code
  create_pwd_reset_code(mail: "user@example.com", lang: EN)

  # Reset password with code
  update_pwd(code: "jwt-code-from-email", new_pwd: "newsecure123")
}
```

**Invite User:**
```graphql
mutation {
  invite_user(mail: "invited@example.com")
}
```

### Docker

```bash
# Build image
docker build -t hydre/auth .

# Run with docker-compose
docker compose up
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

**Coverage Results:**
- ✅ 87.63% Statements
- ✅ 79.05% Branches
- ✅ 76.19% Functions
- ✅ 87.63% Lines

## 📚 Schema

<details>
<summary>Full GraphQL Schema</summary>

```graphql
enum Lang {
  EN
  FR
}

type User {
  uuid: ID!
  mail: String!
  verified: Boolean!
  member_since: String!
}

type Query {
  me: User!
}

type Mutation {
  # User Registration
  create_user(mail: String!, pwd: String!, lang: Lang!): Boolean!
  invite_user(mail: String!): ID!

  # Session Management
  create_session(mail: String!, pwd: String!, remember: Boolean): Boolean!
  delete_session(id: String): Boolean!
  refresh_session: Boolean!

  # Account Verification
  create_account_confirm_code(lang: Lang!): Boolean!
  confirm_account(code: String!): Boolean!

  # Password Management
  create_pwd_reset_code(mail: String!, lang: Lang!): Boolean!
  update_pwd(code: String!, new_pwd: String!): Boolean!
  update_pwd_logged(current_pwd: String!, new_pwd: String!): Boolean!

  # Admin Operations
  admin_update_pwd(mail: String!, new_pwd: String!): Boolean!
  admin_delete_users(mails: [String!]!): Boolean!
}
```
</details>

## 🔐 Security

- **Password Requirements**: 6-32 characters, must include letter + digit, no whitespace
- **Email Validation**: RFC-compliant email regex
- **JWT Algorithm**: ES512 (ECDSA P-521 + SHA-512)
- **Password Hashing**: bcrypt with configurable rounds (default: 12)
- **Rate Limiting**: Configurable delays on password reset and account confirmation
- **Session Security**: HTTP-only cookies, CORS protection, user agent tracking
- **Production Keys**: MUST set PUBLIC_KEY and PRIVATE_KEY env vars (dev keys will error in production)

## 📝 Error Codes

- `MAIL_USED` - Email already registered
- `MAIL_INVALID` - Invalid email format
- `PASSWORD_INVALID` - Password doesn't meet requirements
- `USER_NOT_FOUND` - Invalid credentials or user doesn't exist
- `ILLEGAL_SESSION` - Invalid session or missing user agent
- `NO_PASSWORD` - Invited user hasn't set password yet
- `INVALID_CODE` - Verification/reset code expired or invalid
- `UNAUTHORIZED` - Authentication required
- `REGISTRATION_DISABLED` - Registration not allowed (ALLOW_REGISTRATION=false)
- `SPAM` - Rate limit exceeded
- `MAIL_SERVICE_OFFLINE` - Email notification service unavailable

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 📄 License

MIT © Hydre
