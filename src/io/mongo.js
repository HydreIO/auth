import { MongoClient } from 'mongodb'
const debug = 'mongo' |> require('debug')('auth').extend

export const loadDB = async uri => (
	debug('Connecting to MongoDB'), MongoClient.connect(uri, { useNewUrlParser: true })
)
export const getCollection = mongo => db => collection => mongo.db(db).collection(collection)
