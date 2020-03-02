import mongodb from 'mongodb'
import Debug from 'debug'
import rxjs from 'rxjs'
import operators from 'rxjs/operators'

const debug = Debug('auth').extend('mongo')
const { MongoClient, ObjectID } = mongodb
const { of, from } = rxjs
const { retry, concatMapTo, tap } = operators

export default ({ uri, collection, db, maxRetries }) => {
  let coll
  const fetch = async user => coll.find(user).limit(1).toArray().then(([user]) => {
    if (!user) return undefined
    const { _id, ...u } = user
    return u
  })
  const fetchByUid = async uuid => fetch({ uuid })
  const fetchByMail = async mail => fetch({ mail })
  const pushByUid = async (uuid, user) => coll.updateOne({ uuid }, { $set: user }, { upsert: true })
  const existByMail = async mail => fetch({ mail }).then(a => !!a)

  const connect = async () => {
    debug('initializing.. [maxRetries: %d]', maxRetries)
    let retried = 0
    const mongo = await of(undefined).pipe(
      tap(() => debug('connecting to mongodb.. [%d]', ++retried)),
      concatMapTo(from(MongoClient.connect(uri, { connectTimeoutMS: 5000, useNewUrlParser: true, useUnifiedTopology: true }))),
      retry(maxRetries - 1)
    ).toPromise().catch(e => {
      debug.extend('error')('unable to reach mongodb instance after %d tries.. exit', maxRetries)
      process.exit(1)
    })
    debug('connected!')
    coll = mongo.db(db).collection(collection)
  }
  return { connect, crud: { fetchByUid, fetchByMail, existByMail, pushByUid } }
}



