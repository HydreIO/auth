import { queries, mutations } from './queries'
import debug from 'debug'
import casual from 'casual'

const log = debug('auth').extend('doubt')

'Queries'.doubt(async () => {

  await 'provide a valid certificate'.because(async () => {
    const { cert } = await queries.certificate()
    return cert?.length
  }).isAbove(100)

  await 'fails to retrieve user when we are not authenticated'.because(async () => {
    try {
      await queries.me()
    } catch (error) {
      return error.message.split(':')[0]
    }
    return 'no error was thrown'
  }).isEqualTo('Cookies are invalid or missing')
})

'Mutations'.doubt(async () => {

  const creds = { mail: casual.email, pwd: 'admin1', rememberMe: true }

  await 'signup allow an user to create an account'.because(async () => {
    const { authenticate: { signup: { user, newAccount } } } = await mutations.signup(creds)
    return user
  }).hasKeys(['uuid'])

  await 'signing up twice should fail with a mail_already_used_error'.because(async () => {
    try {
      await mutations.signup(creds)
    } catch (error) {
      return error.message.split(':')[0]
    }
    return 'no error was thrown'
  }).isEqualTo(`The mail address ${creds.mail} is already in use.`)

})

