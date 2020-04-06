import graphql_request from 'graphql-request'
import fetch from 'node-fetch'
import fetch_cookie from 'fetch-cookie/node-fetch'
import debug from 'debug'

// initializing fetch-cookie
fetch_cookie(fetch)

const { GraphQLClient } = graphql_request
const client = new GraphQLClient(process.env.ENDPOINT, {
  headers: { ['user-agent']: 'Opera/9.30 (Nintendo Wii; U; ; 2071; Wii Shop Channel/1.0; en)' },
  credentials: 'include',
  mode: 'cors'
})

export const queries = {
  certificate: async () => client.request(/* GraphQL */ `{ cert }`),
  me: async () => client.request(/* GraphQL */ `{ me { uuid } }`)
}

export const mutations = {
  signup: async creds => {
    const mutation = /* GraphQL */`
    mutation ($creds: Creds!) {
      authenticate {
        signup(creds: $creds) {
          user {
            uuid
          }
          newAccount
        }
      }
    }
    `
    return client.request(mutation, { creds })
  }
}