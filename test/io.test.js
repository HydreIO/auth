import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

// Force local I/O for this test
process.env.DISABLE_IO = 'true'

const { master_client, slave_client, connection_state } = await import(
  '../src/io/index.js'
)
const { user_db, session_db } = await import('../src/database.js')

describe('Local I/O Adapter', () => {
  test('connection state is online', () => {
    assert.strictEqual(connection_state.online, true)
  })

  test('master and slave clients are same instance', () => {
    assert.strictEqual(master_client, slave_client)
  })

  describe('Redis Commands', () => {
    test('JSON.SET and JSON.GET', async () => {
      await master_client.call(
        'JSON.SET',
        'test:obj',
        '.',
        JSON.stringify({ id: 1, name: 'test' })
      )
      const result = await master_client.call('JSON.GET', 'test:obj')
      assert.deepStrictEqual(JSON.parse(result), { id: 1, name: 'test' })
    })

    test('JSON.SET nested path', async () => {
      await master_client.call(
        'JSON.SET',
        'test:obj2',
        '.',
        JSON.stringify({ id: 2, name: 'original' })
      )
      await master_client.call(
        'JSON.SET',
        'test:obj2',
        '.name',
        JSON.stringify('updated')
      )
      const result = await master_client.call('JSON.GET', 'test:obj2')
      assert.deepStrictEqual(JSON.parse(result), { id: 2, name: 'updated' })
    })

    test('JSON.DEL', async () => {
      await master_client.call(
        'JSON.SET',
        'test:del',
        '.',
        JSON.stringify({ id: 3 })
      )
      const deleted = await master_client.call('JSON.DEL', 'test:del')
      assert.strictEqual(deleted, 1)
      const result = await master_client.call('JSON.GET', 'test:del')
      assert.strictEqual(result, null)
    })

    test('SET and GET', async () => {
      await master_client.set('test:string', 'value123')
      const result = await master_client.get('test:string')
      assert.strictEqual(result, 'value123')
    })

    test('DEL', async () => {
      await master_client.set('test:del1', 'a')
      await master_client.set('test:del2', 'b')
      const deleted = await master_client.del('test:del1', 'test:del2')
      assert.strictEqual(deleted, 2)
    })

    test('SADD and SMEMBERS', async () => {
      await master_client.call('SADD', 'test:set', 'a', 'b', 'c')
      const members = await master_client.call('SMEMBERS', 'test:set')
      assert.deepStrictEqual(members.sort(), ['a', 'b', 'c'])
    })

    test('SREM', async () => {
      await master_client.call('SADD', 'test:set2', 'x', 'y', 'z')
      await master_client.call('SREM', 'test:set2', 'y')
      const members = await master_client.call('SMEMBERS', 'test:set2')
      assert.deepStrictEqual(members.sort(), ['x', 'z'])
    })

    test('SETEX and GETDEL', async () => {
      await master_client.setex('test:ttl', 10, 'temp_value')
      const value = await master_client.getdel('test:ttl')
      assert.strictEqual(value, 'temp_value')
      const after = await master_client.get('test:ttl')
      assert.strictEqual(after, null)
    })

    test('publish is no-op', async () => {
      const result = await master_client.publish('test_channel', 'message')
      assert.strictEqual(result, 1)
    })
  })

  describe('Database Layer', () => {
    test('user_db.create and find_by_email', async () => {
      const user = {
        uuid: 'user-1',
        mail: 'test@example.com',
        hash: 'hash123',
        created_at: Date.now(),
      }
      await user_db.create(master_client, user)
      const found = await user_db.find_by_email(
        master_client,
        'test@example.com'
      )
      assert.deepStrictEqual(found, user)
    })

    test('user_db.find_by_uuid', async () => {
      const user = {
        uuid: 'user-2',
        mail: 'test2@example.com',
        hash: 'hash456',
        created_at: Date.now(),
      }
      await user_db.create(master_client, user)
      const found = await user_db.find_by_uuid(master_client, 'user-2')
      assert.deepStrictEqual(found, user)
    })

    test('user_db.update', async () => {
      const user = {
        uuid: 'user-3',
        mail: 'test3@example.com',
        hash: 'original',
        created_at: Date.now(),
      }
      await user_db.create(master_client, user)
      await user_db.update(master_client, 'user-3', { hash: 'updated' })
      const found = await user_db.find_by_uuid(master_client, 'user-3')
      assert.strictEqual(found.hash, 'updated')
    })

    test('session_db.create and find_by_uuid', async () => {
      const session = {
        uuid: 'session-1',
        ip: '127.0.0.1',
        browserName: 'Chrome',
        created_at: Date.now(),
      }
      await session_db.create(master_client, 'user-1', session)
      const found = await session_db.find_by_uuid(master_client, 'session-1')
      assert.deepStrictEqual(found, session)
    })

    test('user_db.get_sessions', async () => {
      const session = {
        uuid: 'session-2',
        ip: '127.0.0.1',
        browserName: 'Firefox',
        created_at: Date.now(),
      }
      await session_db.create(master_client, 'user-1', session)
      const sessions = await user_db.get_sessions(master_client, 'user-1')
      assert.ok(sessions.length >= 1)
      assert.ok(sessions.some((s) => s.uuid === 'session-2'))
    })

    test('session_db.delete', async () => {
      await session_db.delete(master_client, 'user-1', 'session-1')
      const found = await session_db.find_by_uuid(master_client, 'session-1')
      assert.strictEqual(found, null)
    })

    test('user_db.delete removes user and sessions', async () => {
      await user_db.delete(master_client, 'user-1')
      const found = await user_db.find_by_uuid(master_client, 'user-1')
      assert.strictEqual(found, null)
    })
  })
})
