// Default keys for development/testing ONLY (PKCS#8 format for jose compatibility)
// NEVER use these in production - set PUBLIC_KEY and PRIVATE_KEY env vars
const DEV_PUBLIC_KEY =
  '-----BEGIN PUBLIC KEY-----\nMIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQBJQBvvjteYe0AIdfvfdDuhPQPeCkk\nhcMrNOsjOd0KqftOvvzZzgEkIQXijl1G93ZOuxR9vhVO1AwxRFYODYpb/ZgAlPMf\nuy7zXGwRPjzx+pEpTQ2ZHEJMkcLY5XkuVHL3bjgrGi45Py2EUfzkjXxcuqaq4mk0\nU/HiJgYDP6Tw5e6daA8=\n-----END PUBLIC KEY-----'
const DEV_PRIVATE_KEY =
  '-----BEGIN PRIVATE KEY-----\nMIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIBNhif1kZ+cNrhqZlG\nQUEBpjEXFdtjBW1hn7qf0lTf+uz1S56snNI+oRlLB+/xy5Sm8B1BKqSEmuvWCFAp\nMYGoN/ihgYkDgYYABAElAG++O15h7QAh1+990O6E9A94KSSFwys06yM53Qqp+06+\n/NnOASQhBeKOXUb3dk67FH2+FU7UDDFEVg4Nilv9mACU8x+7LvNcbBE+PPH6kSlN\nDZkcQkyRwtjleS5UcvduOCsaLjk/LYRR/OSNfFy6pqriaTRT8eImBgM/pPDl7p1o\nDw==\n-----END PRIVATE KEY-----'

const {
  NODE_ENV = 'development',
  PORT = '3000',
  ORIGINS = '.*',
  PUBLIC_KEY = NODE_ENV === 'production' ? undefined : DEV_PUBLIC_KEY,
  PRIVATE_KEY = NODE_ENV === 'production' ? undefined : DEV_PRIVATE_KEY,
  ACCESS_TOKEN_EXPIRATION = '20m',
  CONFIRM_ACCOUNT_TOKEN_EXPIRATION = '1d',
  ACCESS_TOKEN_COOKIE_NAME = 'virtual-fox',
  COOKIE_SECURE,
  COOKIE_SAMESITE = 'lax',
  COOKIE_DOMAIN,
  COOKIE_PATH = '/',
  MAIL_REGEX = /^(([^\s"(),.:;<>@[\\\]]+(\.[^\s"(),.:;<>@[\\\]]+)*)|(".+"))@((\[(?:\d{1,3}\.){3}\d{1,3}])|(([\dA-Za-z-]+\.)+[A-Za-z]{2,}))$/,
  PWD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{10,32}$/,
  MAX_SESSION_PER_USER = '10',
  SERVER_HOST = 'localhost',
  GRAPHQL_PATH = '/',
  RESET_PASS_DELAY = '5000',
  CONFIRM_ACCOUNT_DELAY = '5000',
  ALLOW_REGISTRATION = 'true',
  ENABLE_EMAIL = 'true',
  SOCKET_NOTIFIER_ADDRESS = 'tcp://0.0.0.0:3001',
  REDIS_HOST = 'localhost',
  REDIS_SENTINEL_PORT = 26379,
  REDIS_MASTER_NAME = 'mymaster',
  BCRYPT_ROUNDS = '12',
  JWT_ISSUER = 'hydre-auth',
  JWT_AUDIENCE = 'hydre-services',
  ALLOWED_EMAILS = '',
} = process.env

// Validate required cryptographic keys
if (!PUBLIC_KEY || !PRIVATE_KEY) {
  throw new Error(
    'CRITICAL: PUBLIC_KEY and PRIVATE_KEY environment variables are required. ' +
      'Never use default keys in production!'
  )
}

// Warn if using default keys (development only)
if (NODE_ENV !== 'production' && PUBLIC_KEY === DEV_PUBLIC_KEY) {
  console.warn(
    '⚠️  WARNING: Using default development keys. Set PUBLIC_KEY and PRIVATE_KEY env vars for production!'
  )
}

const computed_cookie_secure = () => {
  const value = COOKIE_SECURE?.toLowerCase()

  if (value === undefined) return undefined
  /* c8 ignore next 2 */
  // can't be tested
  return value === 'true'
}

// Validate COOKIE_SAMESITE
const valid_samesite = ['strict', 'lax', 'none']
if (
  COOKIE_SAMESITE &&
  !valid_samesite.includes(COOKIE_SAMESITE.toLowerCase())
) {
  throw new Error(
    `COOKIE_SAMESITE must be one of: ${valid_samesite.join(', ')}. Got: ${COOKIE_SAMESITE}`
  )
}

// Parse allowed emails into Set for O(1) lookup
const parse_allowed_emails = () => {
  if (!ALLOWED_EMAILS || ALLOWED_EMAILS.trim() === '') return null
  return new Set(
    ALLOWED_EMAILS.split(';')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0)
  )
}

export const ENVIRONMENT = {
  NODE_ENV,
  PORT: +PORT,
  ORIGINS,
  PUBLIC_KEY,
  PRIVATE_KEY,
  ACCESS_TOKEN_EXPIRATION,
  CONFIRM_ACCOUNT_TOKEN_EXPIRATION,
  ACCESS_TOKEN_COOKIE_NAME,
  COOKIE_SECURE: computed_cookie_secure(),
  COOKIE_SAMESITE,
  COOKIE_PATH,
  COOKIE_DOMAIN,
  MAIL_REGEX: new RegExp(MAIL_REGEX),
  PWD_REGEX: new RegExp(PWD_REGEX),
  MAX_SESSION_PER_USER: +MAX_SESSION_PER_USER,
  SERVER_HOST,
  GRAPHQL_PATH,
  ALLOW_REGISTRATION: `${ALLOW_REGISTRATION}`.toLowerCase() === 'true',
  ENABLE_EMAIL: `${ENABLE_EMAIL}`.toLowerCase() === 'true',
  RESET_PASS_DELAY: +RESET_PASS_DELAY,
  CONFIRM_ACCOUNT_DELAY: +CONFIRM_ACCOUNT_DELAY,
  SOCKET_NOTIFIER_ADDRESS,
  REDIS_HOST,
  REDIS_SENTINEL_PORT: +REDIS_SENTINEL_PORT,
  REDIS_MASTER_NAME,
  BCRYPT_ROUNDS: +BCRYPT_ROUNDS,
  JWT_ISSUER,
  JWT_AUDIENCE,
  ALLOWED_EMAILS: parse_allowed_emails(),
}

export const ERRORS = {
  MAIL_USED: 'MAIL_USED',
  MAIL_INVALID: 'MAIL_INVALID',
  PASSWORD_INVALID: 'PASSWORD_INVALID',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ILLEGAL_SESSION: 'ILLEGAL_SESSION',
  NO_PASSWORD: 'NO_PASSWORD',
  INVALID_CODE: 'INVALID_CODE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  REGISTRATION_DISABLED: 'REGISTRATION_DISABLED',
  SPAM: 'SPAM',
  MAIL_SERVICE_OFFLINE: 'MAIL_SERVICE_OFFLINE',
  CANNOT_DELETE_SELF: 'CANNOT_DELETE_SELF',
}

/**
 * Validates email against whitelist (if configured)
 * @param {string} email - Email to validate
 * @throws {Error} If email not in whitelist
 * @returns {boolean} true if valid or whitelist disabled
 */
export function validate_email_whitelist(email) {
  if (!ENVIRONMENT.ALLOWED_EMAILS) return true

  const normalized_email = email.trim().toLowerCase()
  if (!ENVIRONMENT.ALLOWED_EMAILS.has(normalized_email)) {
    throw new Error(ERRORS.UNAUTHORIZED)
  }

  return true
}
