import bcrypt from 'bcryptjs'
export const hash = async pwd => bcrypt.hash(pwd, 10)
export const verify = pwd => async hash => bcrypt.compare(pwd, hash)