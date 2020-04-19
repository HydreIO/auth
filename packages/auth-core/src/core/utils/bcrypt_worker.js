import { parentPort } from 'worker_threads'
import bcrypt from 'bcryptjs'

const hash = async pwd => bcrypt.hash(pwd, 10)

const verify = async ({ hash, pwd }) => {
  if (!pwd) throw new Error('pwd is undefined')
  if (!hash) throw new Error('hash is undefined')
  return bcrypt.compare(pwd, hash)
}

parentPort.on('message', async ({ hash_operation, verify_operation }) => {
  if (hash_operation) {
    const hashed = await hash(hash_operation.pwd)
    parentPort.postMessage(hashed)
  } else if (verify_operation) {
    const verified = await verify(verify_operation)
    parentPort.postMessage(verified)
  } else throw new Error('No operation specified!')
})