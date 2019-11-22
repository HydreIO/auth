import crypto from 'crypto'
import { ObjectID } from 'mongodb'
import { hash } from '../../../utils/crypt'
import { TooManyResetRequestError, BadPwdFormatError, InvalidResetCodeError } from '../../errors'

const debug = require('debug')('auth').extend('resetpwd')

export default async (_, { email, newPwd, resetCode }, { findUser, checkPwdFormat, updateUser }) =>
	(await findUser({ email }))
	|> (async user => {
		debug('asking pwd reset')
		if (user) {
			debug('user found, checking password format')
			checkPwdFormat(newPwd) || throw new BadPwdFormatError()
			if(!user.resetCode || user.resetCode !== resetCode) throw new InvalidResetCodeError()
			user.hash = await hash(newPwd)
			user.resetCode = ''
			debug('upserting user')
			await updateUser({ _id: new ObjectID(user._id.toString()) })(user)
		}
		return true
	})
