import AWS from 'aws-sdk'
import * as constants from './constant'

const debug = require('debug')('auth').extend('ssm')

const ssm = new AWS.SSM({ apiVersion: '2014-11-06' })
const okNo = ok => no => (err, data) => (err ? no(err) : ok(data))

const fetchParams = async Names =>
	(await new Promise((ok, no) => ssm.getParameters({ Names, WithDecryption: true }, okNo(ok)(no))))
	|> (_ => _?.Parameters?.map(param => [param.Name, param.Value]))

const processBatch = batchs => batchs.map(fetchParams) |> Promise.all

const separate = entries =>
	entries.reduce(
		(acc, [k, v]) =>
			process.env[v] |> (val => (acc[+!!val].push(val ? [k, val] : constants[k]), acc)),
		[[], []]
	)

const batch10 = values =>
	values.reduce(
		(acc, val, i) => (acc[Math.floor(i / 10)].push(val), acc),
		[...Array(Math.ceil(values.length / 10))].map(_ => [])
	)

export const loadParams = async () =>
	Object.entries(constants)
	|> (_ => (debug(`Requesting ${_.length} parameters`), _))
	|> separate
	|> (_ => (debug(`env contains ${_[1].length} parameters`), _))
	|> (_ => (debug(`SSM will load ${_[0].length} parameters`), _))
	|> (async separated => [
		...(await (separated[0] |> batch10 |> processBatch)).flat(1),
		...separated[1]
	])
	|> (async result => Object.fromEntries(await result))
