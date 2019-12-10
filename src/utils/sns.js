import AWS from 'aws-sdk'

const SNS = new AWS.SNS({ apiVersion: '2010-03-31' })
const debug = require('debug')('auth').extend('sns')

const publish = topic => async msg => SNS.publish({	Message: msg,	TopicArn: topic}).promise().then(data => debug(`Aws SNS was notified [${topic}]`))
const mock = topic => async msg => debug(`[local mode] => Publishing to SNS[${topic}] \n%o`, msg)

export const publishToSNS = topic => async msg => {
	return process.env.NODE_ENV === 'development' ? mock(topic)(msg) : publish(topic)(msg)
}