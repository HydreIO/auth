import AWS from 'aws-sdk'

const SNS = new AWS.SNS({apiVersion: '2010-03-31'})
const debug = require('debug')('auth').extend('sns')

export const publishPassReset = msg => SNS.publish({
	Message: msg,
	TopicArn: 'auth_reset_pass'
}) .promise().then(data=>debug('Aws SNS was notified [password reset]'))