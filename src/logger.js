import pino from 'pino'

// Create logger instance with default configuration
// Use pino-pretty for development, JSON for production
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Redact sensitive fields to prevent credential leaks
  redact: {
    paths: [
      'password',
      'pwd',
      'hash',
      'reset_code',
      'code',
      'token',
      'access_token',
      'id_token',
      'refresh_token',
      'client_secret',
      'authorization',
      '*.password',
      '*.pwd',
      '*.hash',
      '*.reset_code',
      '*.code',
      '*.token',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
})

export default logger
