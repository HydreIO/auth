import { MongoClient, ObjectID } from 'mongodb'

const debug = 'mongo' |> require('debug')('auth').extend
const idOrField = user => user._id ? { _id: new ObjectID(user._id) } : user

export default ({ uri, collection, db }) => {
  let coll
  return {
    connect: async () => {
      debug('connecting..')
      const mongo = await MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
      coll = mongo.db(db).collection(collection)
    },
    crud: {
      fetch: async user => coll.find(user |> idOrField).limit(1).toArray().then(([user]) => (user?._id ? { ...user, _id: user?._id?.toString() } : undefined)),
      push: async user => coll.updateOne(user |> idOrField, { $set: user |> (({ _id, ...u }) => u) }, { upsert: true }),
      exist: async user => coll.find(user).limit(1).toArray().then(a => !!a.length)
    }
  }
}