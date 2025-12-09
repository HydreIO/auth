import { describe, test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'

import {
  connection_state,
  user_db,
  session_db,
  clear_database,
  close_database,
} from '../src/database.js'

describe('Database Layer', () => {
  beforeEach(async () => {
    await clear_database()
  })

  after(async () => {
    await close_database()
  })

  test('connection state is online', () => {
    assert.strictEqual(connection_state.online, true)
  })

  describe('User Operations', () => {
    test('user_db.create and find_by_email', async () => {
      const user = {
        uuid: 'user-1',
        mail: 'test@example.com',
        hash: 'hash123',
        created_at: Date.now(),
      }
      await user_db.create(user)
      const found = await user_db.find_by_email('test@example.com')
      assert.strictEqual(found.uuid, user.uuid)
      assert.strictEqual(found.mail, user.mail)
      assert.strictEqual(found.hash, user.hash)
    })

    test('user_db.find_by_email returns null for non-existent', async () => {
      const found = await user_db.find_by_email('nonexistent@example.com')
      assert.strictEqual(found, null)
    })

    test('user_db.find_by_uuid', async () => {
      const user = {
        uuid: 'user-2',
        mail: 'test2@example.com',
        hash: 'hash456',
        created_at: Date.now(),
      }
      await user_db.create(user)
      const found = await user_db.find_by_uuid('user-2')
      assert.strictEqual(found.uuid, user.uuid)
      assert.strictEqual(found.mail, user.mail)
    })

    test('user_db.find_by_uuid returns null for non-existent', async () => {
      const found = await user_db.find_by_uuid('nonexistent')
      assert.strictEqual(found, null)
    })

    test('user_db.update', async () => {
      const user = {
        uuid: 'user-3',
        mail: 'test3@example.com',
        hash: 'original',
        created_at: Date.now(),
      }
      await user_db.create(user)
      await user_db.update('user-3', { hash: 'updated' })
      const found = await user_db.find_by_uuid('user-3')
      assert.strictEqual(found.hash, 'updated')
    })

    test('user_db.update handles email change', async () => {
      const user = {
        uuid: 'user-4',
        mail: 'old@example.com',
        hash: 'hash',
        created_at: Date.now(),
      }
      await user_db.create(user)
      await user_db.update('user-4', { mail: 'new@example.com' })

      // Old email should not find user
      const not_found = await user_db.find_by_email('old@example.com')
      assert.strictEqual(not_found, null)

      // New email should find user
      const found = await user_db.find_by_email('new@example.com')
      assert.strictEqual(found.uuid, 'user-4')
    })

    test('user_db.update on non-existent user is no-op', async () => {
      // Should not throw
      await user_db.update('nonexistent', { hash: 'value' })
    })

    test('user_db.delete', async () => {
      const user = {
        uuid: 'user-5',
        mail: 'delete@example.com',
        hash: 'hash',
        created_at: Date.now(),
      }
      await user_db.create(user)
      await user_db.delete('user-5')
      const found = await user_db.find_by_uuid('user-5')
      assert.strictEqual(found, null)
    })

    test('user_db.delete on non-existent user is no-op', async () => {
      // Should not throw
      await user_db.delete('nonexistent')
    })
  })

  describe('Session Operations', () => {
    test('session_db.create and find_by_uuid', async () => {
      // Create user first
      await user_db.create({
        uuid: 'user-1',
        mail: 'test@example.com',
        hash: 'hash',
        created_at: Date.now(),
      })

      const session = {
        uuid: 'session-1',
        ip: '127.0.0.1',
        browserName: 'Chrome',
        created_at: Date.now(),
      }
      await session_db.create('user-1', session)
      const found = await session_db.find_by_uuid('session-1')
      assert.strictEqual(found.uuid, session.uuid)
      assert.strictEqual(found.ip, session.ip)
      assert.strictEqual(found.browserName, session.browserName)
    })

    test('session_db.find_by_uuid returns null for non-existent', async () => {
      const found = await session_db.find_by_uuid('nonexistent')
      assert.strictEqual(found, null)
    })

    test('session_db.update', async () => {
      await user_db.create({
        uuid: 'user-2',
        mail: 'test2@example.com',
        hash: 'hash',
        created_at: Date.now(),
      })

      const session = {
        uuid: 'session-2',
        ip: '127.0.0.1',
        browserName: 'Chrome',
        created_at: Date.now(),
      }
      await session_db.create('user-2', session)
      await session_db.update('session-2', { ip: '192.168.1.1' })

      const found = await session_db.find_by_uuid('session-2')
      assert.strictEqual(found.ip, '192.168.1.1')
    })

    test('session_db.update on non-existent session is no-op', async () => {
      // Should not throw
      await session_db.update('nonexistent', { ip: '1.2.3.4' })
    })

    test('user_db.get_sessions', async () => {
      await user_db.create({
        uuid: 'user-3',
        mail: 'test3@example.com',
        hash: 'hash',
        created_at: Date.now(),
      })

      const session1 = {
        uuid: 'session-3a',
        ip: '127.0.0.1',
        browserName: 'Chrome',
        created_at: Date.now(),
      }
      const session2 = {
        uuid: 'session-3b',
        ip: '127.0.0.2',
        browserName: 'Firefox',
        created_at: Date.now(),
      }

      await session_db.create('user-3', session1)
      await session_db.create('user-3', session2)

      const sessions = await user_db.get_sessions('user-3')
      assert.strictEqual(sessions.length, 2)
      assert.ok(sessions.some((s) => s.uuid === 'session-3a'))
      assert.ok(sessions.some((s) => s.uuid === 'session-3b'))
    })

    test('user_db.get_sessions returns empty for user with no sessions', async () => {
      await user_db.create({
        uuid: 'user-4',
        mail: 'test4@example.com',
        hash: 'hash',
        created_at: Date.now(),
      })

      const sessions = await user_db.get_sessions('user-4')
      assert.deepStrictEqual(sessions, [])
    })

    test('user_db.get_sessions returns empty for non-existent user', async () => {
      const sessions = await user_db.get_sessions('nonexistent')
      assert.deepStrictEqual(sessions, [])
    })

    test('session_db.delete', async () => {
      await user_db.create({
        uuid: 'user-5',
        mail: 'test5@example.com',
        hash: 'hash',
        created_at: Date.now(),
      })

      const session = {
        uuid: 'session-5',
        ip: '127.0.0.1',
        browserName: 'Chrome',
        created_at: Date.now(),
      }
      await session_db.create('user-5', session)
      await session_db.delete('user-5', 'session-5')

      const found = await session_db.find_by_uuid('session-5')
      assert.strictEqual(found, null)
    })

    test('session_db.delete_all_for_user', async () => {
      await user_db.create({
        uuid: 'user-6',
        mail: 'test6@example.com',
        hash: 'hash',
        created_at: Date.now(),
      })

      await session_db.create('user-6', {
        uuid: 'session-6a',
        ip: '127.0.0.1',
        browserName: 'Chrome',
        created_at: Date.now(),
      })
      await session_db.create('user-6', {
        uuid: 'session-6b',
        ip: '127.0.0.2',
        browserName: 'Firefox',
        created_at: Date.now(),
      })

      await session_db.delete_all_for_user('user-6')

      const sessions = await user_db.get_sessions('user-6')
      assert.deepStrictEqual(sessions, [])
    })

    test('user_db.delete removes user and all sessions', async () => {
      await user_db.create({
        uuid: 'user-7',
        mail: 'test7@example.com',
        hash: 'hash',
        created_at: Date.now(),
      })

      await session_db.create('user-7', {
        uuid: 'session-7',
        ip: '127.0.0.1',
        browserName: 'Chrome',
        created_at: Date.now(),
      })

      await user_db.delete('user-7')

      const user = await user_db.find_by_uuid('user-7')
      const session = await session_db.find_by_uuid('session-7')

      assert.strictEqual(user, null)
      assert.strictEqual(session, null)
    })
  })
})
