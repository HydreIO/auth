import { Graph } from 'redisgraph.js'
import neo4j from 'neo4j-driver'
import { from, zip } from 'rxjs'
import { toArray, reduce, map } from 'rxjs/operators'

const debug = 'graph' |> require('debug')('auth').extend
const graph = new Graph('test', 6379, '127.0.0.1')

export default () => ({
  connect: async () => {

    const foo = async (...a) => {
      const [raw, ...args] = a
      args.push('')

      const isDouble = n => 
      const respifyValue = v => {
        if (!v) return 'NULL'
        switch (typeof v) {
          case 'boolean':
            return v ? 'true' : 'false'
          case 'number':
            return Number.isSafeInteger(v) ? v : `${v}`
          case 'bigint':
            return `${v}`
            case 'function':
            case 'symbol':
              return undefined
        }
      }

      await zip(from(raw), from(args).pipe(map(v => {

      })))
        .pipe(reduce((acc, [a, b]) => [...acc, a, b], []), map(a => a.join('')))
        .toPromise().then(a => console.log(a))
    }

    const user = { uuid: 'xxx-xx-xxx', name: 'Tony' }
    await foo`MERGE (foo:User ${user})-[:Knows]->(thanos { name: 'Thanos', age: ${5 + 5}, a: ${true}, b: ${922337203685477580750}, c: ${51.0000000000000016} }) RETURN foo AS user, thanos`

    process.exit(0)

    const driver = rgraph(client)
    const graphA = driver('aGraph')
    const graphB = drive('anotherGraph')


    const result$ = graphA`MERGE (foo:User ${user})-[:Knows]->(thanos { name: 'Thanos', age: ${5 + 5} }) RETURN foo AS user, thanos`
    result$.pipe(
      tap(({ stats }) => console.log(stats))
    ).subscribe(({ user, thanos }) => console.log(user.name)) // print Tony

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