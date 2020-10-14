/* eslint-disable max-len */
const {
  PORT = '3000',
  ORIGINS = '.*',
  PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQAaW4NpvoFJ6r0q4Cg5y4V9fTkk/RM\n+XYzFWST7bOog8k/5TBYvEHZoyHpsI/9KSQ6Bk0cjCeR9HuUvUW/PTQPu6YB61Wh\nwPVCjYEZKjPLiVJvo44Ck4fada/CBuSgwdTviU+SFUTU1v/nOy89IMjF4Wa0QjXw\ndL2UmIx6GiXqQYebdxw=\n-----END PUBLIC KEY-----', // ES512,
  PRIVATE_KEY = '-----BEGIN EC PRIVATE KEY-----\nMIHcAgEBBEIAumGgZ9d0sD4A1Ch6vLWcF2ryd7o49Mz7F/bEHjYZcMRopsazPXzs\nDj+wZzoqCYE2uEXcl+1kS/hBsubqwZ+kLD+gBwYFK4EEACOhgYkDgYYABABpbg2m\n+gUnqvSrgKDnLhX19OST9Ez5djMVZJPts6iDyT/lMFi8QdmjIemwj/0pJDoGTRyM\nJ5H0e5S9Rb89NA+7pgHrVaHA9UKNgRkqM8uJUm+jjgKTh9p1r8IG5KDB1O+JT5IV\nRNTW/+c7Lz0gyMXhZrRCNfB0vZSYjHoaJepBh5t3HA==\n-----END EC PRIVATE KEY-----', // ES512,
  ACCESS_TOKEN_EXPIRATION = '20m',
  CONFIRM_ACCOUNT_TOKEN_EXPIRATION = '1d',
  ACCESS_TOKEN_COOKIE_NAME = 'virtual-fox',
  COOKIE_SECURE,
  COOKIE_SAMESITE,
  COOKIE_DOMAIN,
  COOKIE_PATH = '/',
  // eslint-disable-next-line unicorn/no-unsafe-regex
  MAIL_REGEX = /^(([^\s"(),.:;<>@[\\\]]+(\.[^\s"(),.:;<>@[\\\]]+)*)|(".+"))@((\[(?:\d{1,3}\.){3}\d{1,3}])|(([\dA-Za-z\-]+\.)+[A-Za-z]{2,}))$/,
  PWD_REGEX = /^(?!.*\s)(?=.*[A-Za-z])(?=.*\d)(?=.{6,32})/,
  MAX_SESSION_PER_USER = '10',
  SERVER_HOST = 'localhost',
  GRAPHQL_PATH = '/',
  RESET_PASS_DELAY = '5000',
  CONFIRM_ACCOUNT_DELAY = '5000',
  ALLOW_REGISTRATION = 'true',
  SOCKET_NOTIFIER_ADDRESS = 'tcp://0.0.0.0:3001',
  REDIS_HOST = 'localhost',
  REDIS_SENTINEL_PORT = 26379,
  REDIS_MASTER_NAME = 'mymaster',
  GRAPH_NAME = 'default',
} = process.env
const computed_cookie_secure = () => {
  const value = COOKIE_SECURE?.toLowerCase()

  if (value === undefined) return undefined
  /* c8 ignore next 2 */
  // can't be tested
  return value === 'true'
}

export const ENVIRONMENT = {
  PORT                 : +PORT,
  ORIGINS,
  PUBLIC_KEY,
  PRIVATE_KEY,
  ACCESS_TOKEN_EXPIRATION,
  CONFIRM_ACCOUNT_TOKEN_EXPIRATION,
  ACCESS_TOKEN_COOKIE_NAME,
  COOKIE_SECURE        : computed_cookie_secure(),
  COOKIE_SAMESITE,
  COOKIE_PATH,
  COOKIE_DOMAIN,
  MAIL_REGEX           : new RegExp(MAIL_REGEX),
  PWD_REGEX            : new RegExp(PWD_REGEX),
  MAX_SESSION_PER_USER : +MAX_SESSION_PER_USER,
  SERVER_HOST,
  GRAPHQL_PATH,
  ALLOW_REGISTRATION   : `${ ALLOW_REGISTRATION }`.toLowerCase() === 'true',
  RESET_PASS_DELAY     : +RESET_PASS_DELAY,
  CONFIRM_ACCOUNT_DELAY: +CONFIRM_ACCOUNT_DELAY,
  SOCKET_NOTIFIER_ADDRESS,
  REDIS_HOST,
  REDIS_SENTINEL_PORT  : +REDIS_SENTINEL_PORT,
  REDIS_MASTER_NAME,
  GRAPH_NAME,
}

export const ERRORS = {
  MAIL_USED            : 'MAIL_USED',
  MAIL_INVALID         : 'MAIL_INVALID',
  PASSWORD_INVALID     : 'PASSWORD_INVALID',
  USER_NOT_FOUND       : 'USER_NOT_FOUND',
  ILLEGAL_SESSION      : 'ILLEGAL_SESSION',
  NO_PASSWORD          : 'NO_PASSWORD',
  INVALID_CODE         : 'INVALID_CODE',
  UNAUTHORIZED         : 'UNAUTHORIZED',
  REGISTRATION_DISABLED: 'REGISTRATION_DISABLED',
  SPAM                 : 'SPAM',
  MAIL_SERVICE_OFFLINE : 'MAIL_SERVICE_OFFLINE',
}
