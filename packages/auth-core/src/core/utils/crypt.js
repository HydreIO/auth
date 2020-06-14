import bcrypt from 'bcryptjs'
export const hash = async pwd => bcrypt.hash(pwd, 10)
export const verify = pwd => async hash => {
  if (!pwd) throw new Error('pwd is undefined')
  if (!hash) throw new Error('hash is undefined')
  return bcrypt.compare(pwd, hash)
}
