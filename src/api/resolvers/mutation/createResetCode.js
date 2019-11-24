import crypto from 'crypto'
import { ObjectID } from 'mongodb'
import { TooManyResetRequestError } from '../../errors'
import { publishToSNS } from '../../../utils/sns'

const debug = require('debug')('auth').extend('resetCode')

export default async (_, { email }, { findUser, LABEL, updateUser, resetCodeDelay }) =>
	(await findUser({ email }))
	|> (async user => {
		debug('asking resetcode')
		// we don't want our api to notify anything in case the email is not associated
		// with an account, so we act like nothing hapenned in case there is no user
		if (user) {
			debug('User with email %s was found', email)

			// allowing this query only once every X ms
			if (user.lastResetEmailSent + resetCodeDelay > Date.now()) throw new TooManyResetRequestError()

			// if the code already exist we retrieve it, if not we create a new one
			const code = (user.resetCode ||= crypto
				.createHash('sha256')
				.update(`${email}${crypto.randomBytes(32).toString('hex')}`)
				.digest('hex'))

				user.lastResetEmailSent = Date.now()
			debug('emailing code')
			await publishToSNS(`${LABEL}:auth:reset_pass`)(JSON.stringify({ to: email, code }))
			debug('updating user')
			await updateUser({ _id: new ObjectID(user._id) })(user)
		} else debug(`user doesn't exist`)
		debug('returning!')
		return true
	})
