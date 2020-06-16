import graphql_request from 'graphql-request'
import fetch from 'node-fetch'
import fetch_cookie from 'fetch-cookie/node-fetch'
import tough from 'tough-cookie'
import debug from 'debug'

// initializing fetch-cookie
global['fetch'] = fetch_cookie(
  fetch,
  new tough.CookieJar(new tough.MemoryCookieStore(), {
    rejectPublicSuffixes: false,
    allowSpecialUseDomain: true,
  })
)

const { GraphQLClient } = graphql_request
const client = new GraphQLClient(process.env.ENDPOINT, {
  headers: {
    ['user-agent']:
      'Opera/9.30 (Nintendo Wii; U; ; 2071; Wii Shop Channel/1.0; en)',
  },
  credentials: 'include',
  mode: 'cors',
})

export const queries = {
  certificate: async () =>
    client.request(/* GraphQL */ `
      {
        cert
      }
    `),
  me: async () =>
    client.request(/* GraphQL */ `
      {
        me {
          uuid
          mail
        }
      }
    `),
}

export const mutations = {
  signup: async creds => {
    const mutation = /* GraphQL */ `
      mutation($creds: Creds!) {
        authenticate {
          signup(creds: $creds) {
            user {
              mail
            }
            newAccount
          }
        }
      }
    `
    return client.request(mutation, { creds })
  },
  signout: async () =>
    client.request(/* GraphQL */ `
      mutation {
        authenticate {
          signout
        }
      }
    `),
  signin: async creds => {
    const mutation = /* GraphQL */ `
      mutation($creds: Creds!) {
        authenticate {
          signin(creds: $creds) {
            user {
              mail
            }
            newAccount
          }
        }
      }
    `
    return client.request(mutation, { creds })
  },
  refresh: async () =>
    client.request(/* GraphQL */ `
      mutation {
        me {
          refresh
        }
      }
    `),
}
