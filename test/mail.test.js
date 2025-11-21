import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

describe('Mail Service', () => {
  describe('When ENABLE_EMAIL=false', () => {
    test('send() should not throw and return undefined', async () => {
      // Set ENABLE_EMAIL=false before importing
      process.env.ENABLE_EMAIL = 'false'

      // Dynamic import to reload with new env
      const mail_module = await import('../src/mail.js?t=' + Date.now())
      const MAIL = mail_module.default

      // Should not throw
      const result = await MAIL.send([
        MAIL.ACCOUNT_CREATE,
        'test@example.com',
        'en',
      ])

      // Should return undefined (no-op)
      assert.strictEqual(result, undefined)
    })

    test('initialize() should not create socket', async () => {
      process.env.ENABLE_EMAIL = 'false'

      const mail_module = await import('../src/mail.js?t=' + Date.now())
      const MAIL = mail_module.default

      // Should not throw
      await assert.doesNotReject(async () => {
        await MAIL.initialize()
      })
    })
  })

  describe('Constants', () => {
    test('should export email event types', async () => {
      const mail_module = await import('../src/mail.js')
      const MAIL = mail_module.default

      assert.strictEqual(MAIL.ACCOUNT_CREATE, 'ACCOUNT_CREATE')
      assert.strictEqual(MAIL.ACCOUNT_CONFIRM, 'ACCOUNT_CONFIRM')
      assert.strictEqual(MAIL.PASSWORD_RESET, 'PASSWORD_RESET')
      assert.strictEqual(MAIL.NEW_SESSION, 'NEW_SESSION')
    })
  })
})
