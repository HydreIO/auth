import threadPool from 'node-worker-threads-pool'
import os from 'os'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const pool = new threadPool.StaticPool({
  size: os.cpus().length,
  task: `${dirname(fileURLToPath(import.meta.url))}/bcrypt_worker.js`
})

export const hash = async pwd => pool.exec({ hash_operation: { pwd } })
export const verify = pwd => async hash => pool.exec({ verify_operation: { pwd, hash } })