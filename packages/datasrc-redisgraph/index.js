import { Graph } from 'redisgraph.js'
import { map, concat, flatMap, concatMap, tap, toArray, reduce } from 'rxjs/operators'
import { from, zip, defer, of } from 'rxjs'
import neo4j from 'neo4j-driver'
import redis from 'redis'
import { promisify, isArray, inspect } from 'util'

const debug = 'graph' |> require('debug')('auth').extend
const graph = new Graph('test', 6379, '127.0.0.1')

const RESULT_TYPE = {
  UNKNOWN: 0,
  SCALAR: 1,
  NODE: 2,
  RELATION: 3
}

const CC = ['UNKNOWN', 'SCALAR', 'NODE', 'RELATION']

const DATA_TYPE = {
  UNKNOWN: 0,
  NULL: 1,
  STRING: 2,
  INTEGER: 3,
  BOOLEAN: 4,
  DOUBLE: 5,
  ARRAY: 6,
  EDGE: 7,
  NODE: 8,
  PATH: 9
}

export default () => ({
  connect: async () => {

    const client = redis.createClient(6379, '127.0.0.1')
    const sendCmd = promisify(client.send_command).bind(client)

    client.on("error", function (error) {
      console.error(error);
    });

    const cachedKeys = procedure => graphId => {
      const monad = { keys: [] }
      const fetch = async () => {
        const toYield = procedure.slice(3, -3)
        const args = [graphId, `CALL ${procedure} YIELD ${toYield} RETURN ${toYield} SKIP ${monad.keys.length}`]
        const [, missing] = await sendCmd('graph.QUERY', args)
        if (missing.some(a => a.length > 1)) throw new Error('This version of the driver does not support multi labels on nodes :shrug:')
        monad.keys = [...monad.keys, ...missing.flat()]
      }
      return async index => {
        index >= monad.keys.length && await fetch()
        return monad.keys[index]
      }
    }

    const labels = cachedKeys('db.labels()')('test')
    const relationsKeys = cachedKeys('db.relationshipTypes()')('test')
    const propertyKeys = cachedKeys('db.propertyKeys()')('test')

    const parseScalar$ = ([type, value]) => {
      switch (type) {
        case DATA_TYPE.UNKNOWN:
        case DATA_TYPE.NULL:
          return of(undefined)
        case DATA_TYPE.DOUBLE:
          return of(+value)
        case DATA_TYPE.BOOLEAN:
          return of(value === 'true')
        case DATA_TYPE.ARRAY:
          return from(value).pipe(flatMap(parseScalar$))
        case DATA_TYPE.NODE:
          return parseNode$(value)
        case DATA_TYPE.EDGE:
          return parseEdge$(value)
        case DATA_TYPE.PATH:
          return parsePath$(value)
        default: return of(value)
      }
    }
    const parseProp$ = ([key, type, value]) => defer(async () => [await propertyKeys(key), await parseScalar$([type, value]).toPromise()])
    const parseProps$ = props => from(props).pipe(concatMap(parseProp$), toArray(), map(Object.fromEntries))
    const parseNode$ = ([id, nodeLabels, props]) => defer(async () => ({
      id,
      labels: await from(nodeLabels).pipe(concatMap(i => from(labels(i))), toArray()).toPromise(),
      properties: await parseProps$(props).toPromise()
    }))
    const parseEdge$ = ([id, type, srcNodeId, destNodeId, props]) => defer(async () => ({
      id,
      label: await relationsKeys(type),
      srcNodeId,
      destNodeId,
      properties: await parseProps$(props).toPromise()
    }))
    const parsePathRow$ = path => from(path).pipe(concatMap(parseScalar$), toArray())
    const parsePath$ = ([[, nodes], [, edges]]) => defer(async () => ({
      nodes: await parsePathRow$(nodes).toPromise(),
      edges: await parsePathRow$(edges).toPromise()
    }))

    // const query = `MERGE (a:Test:Tested {who:"-> a",uuid: 981.5, foo:'bar'})-[b:FOO {who:"-> b",since: 'a long time ago'}]->(c:OK {who:"-> c", arr:['one',2,'three']}) RETURN a.foo,b,c`
    await sendCmd('graph.QUERY', ['test', `CREATE (a:Test {who:"-> a",uuid: 981.5, foo:'bar'})-[b:FOO {who:"-> b",since: 'a long time ago'}]->(c:OK {who:"-> c", arr:['one',2,'three']})`])
    const query = `MATCH path = ()-[]->() RETURN path`

    from(sendCmd('graph.QUERY', ['test', query, '--compact']))
      .pipe(
        tap(() => debug.extend('query')('%s', query)),
        tap(([, , stats]) => debug.extend('stats')(stats)),
        flatMap(([header, [cell]]) => zip(from(header), from(cell))),
        concatMap(([[cellType, label], cell]) => defer(async () => {
          switch (cellType) {
            case RESULT_TYPE.NODE:
              return { label, value: await parseNode$(cell).toPromise() }
            case RESULT_TYPE.RELATION:
              return { label, value: await parseEdge$(cell).toPromise() }
            case RESULT_TYPE.SCALAR:
              return { label, value: await parseScalar$(cell).toPromise() }
            case RESULT_TYPE.UNKNOWN:
              throw new Error(`The cell of type ${cellType} is unkown billy, the end is near.. get cover!`)
          }
        }))
      )
      .subscribe({
        next(a) {
          debug.extend('result')('%s', inspect(a, false, null, true))
        },
        async complete() {
          debug('deleting graph..')
          await sendCmd('graph.DELETE', ['test'])
          debug('Bye.')
          process.exit(0)
        }
      })


    // const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PWD), { encrypted: "ENCRYPTION_ON" })
    // const rxs = driver.rxSession()
    // const foo = { 'a': 1, 'b': 2 }
    // // const res = await graph.query('MATCH (u:User {uuid: 0}) SET u += $user RETURN u', { user: foo })
    // // await rxs.run('MERGE (u:Test {uuid: 0}) SET u += $user RETURN u', { user: foo })
    // //   .records()
    // //   .pipe(map(r => r.get('u')), concat(rxs.close()))
    // //   .toPromise()


    // // debug('testing..')
    // // const user = {
    // //   name: 'Sceat',
    // //   aaa: 50
    // //   // test: {
    // //   //   a: 1
    // //   // },
    // //   // sessions: [
    // //   //   { foo: 1, bar: 'a' }
    // //   // ]
    // // }
    // const res = await graph.query('MERGE (u:User {uuid: 0}) SET u = $user RETURN u', { 'user': foo })
    // // await graph.query(`MERGE (user:User $user)`, { user })
    // // const res = await graph.query("MATCH (u:User {uuid: 50}) SET u.uuid = 51 RETURN u")
    // while (res.hasNext()) {
    //   let record = res.next();
    //   debug(record.get("u"));
    // }
  },
  crud: {}
})

// export default ({ uri, user, pwd }) => ({
//   async connect() {
//     debug('connecting..')
//     driver = neo4j.driver(uri, neo4j.auth.basic(user, pwd), { encrypted: "ENCRYPTION_ON" })
//   },
//   crud: {
//     async fetchByUid(uuid) {
//       const rxs = driver.rxSession()
//       return await rxs
//         .run('MATCH (user:User {uuid: $uuid}) RETURN user', { uuid })
//         .records()
//         .pipe(map(r => r.get('user')), concat(rxs.close()))
//         .toPromise()
//     },
//     async fetchByMail(mail) {
//       const rxs = driver.rxSession()
//       return await rxs
//         .run('MATCH (user:User {mail: $mail}) RETURN user', { mail })
//         .records()
//         .pipe(map(r => r.get('user')), concat(rxs.close()))
//         .toPromise()
//     },
//     async pushByUid(uuid, user) {
//       const rxs = driver.rxSession()

//       user.sessions = user.sessions.map(s => JSON.stringify(s))
//       const u = { ...user }
//       delete u[Symbol.transient]
//       debug('pushing %O', u)
//       return rxs
//         .run('MERGE (user:User {uuid: $uuid}) SET user += $user', { uuid, user: u })
//         .records()
//         .pipe(concat(rxs.close()))
//         .toPromise()
//     },
//     async existByMail(mail) {
//       const rxs = driver.rxSession()
//       return rxs
//         .run('MATCH (user:User {mail: $mail}) RETURN user', { mail })
//         .records()
//         .pipe(map(r => !!r.get('user')), concat(rxs.close()))
//         .toPromise()
//     }
//   }
// })