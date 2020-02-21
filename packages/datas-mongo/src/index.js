import { MongoClient, ObjectID } from 'mongodb'

const debug = 'mongo' |> require('debug')('auth').extend

export default ({ uri, collection, db }) => {
  let coll
  const fetch = async user => coll.find(user).limit(1).toArray().then(([user]) => user ? user |> (({ _id, ...u }) => u) : undefined)
  const fetchByUid = async uuid => fetch({ uuid })
  const fetchByMail = async mail => fetch({ mail })
  const pushByUid = async (uuid, user) => coll.updateOne({ uuid }, { $set: user }, { upsert: true })
  const existByMail = async mail => fetch({ mail }).then(a => !!a)
  const connect = async () => {
    debug('connecting..')
    const mongo = await MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    coll = mongo.db(db).collection(collection)
  }
  return { connect, crud: { fetchByUid, fetchByMail, existByMail, push } }
}



