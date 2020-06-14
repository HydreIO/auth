import { queries, mutations } from './queries'
import debug from 'debug'
import casual from 'casual'

const log = debug('auth').extend('doubt')

'Simple queries'.doubt(async () => {
  await 'provide a valid certificate'
    .because(async () => {
      const { cert } = await queries.certificate()
      return cert?.length
    })
    .isAbove(100)

  await 'fails to retrieve user when we are not authenticated'
    .because(async () => {
      try {
        await queries.me()
      } catch (error) {
        return error.message.split(':')[0]
      }
      return 'no error was thrown'
    })
    .isEqualTo('Cookies are invalid or missing')
})

'Sign flow'.doubt(async () => {
  const creds = {
    mail: 'pepeg@peepo.wanadoo',
    pwd: 'admin1',
    rememberMe: true,
  }

  await 'signup allow an user to create an account'
    .because(async () => {
      const {
        authenticate: {
          signup: {
            user: { mail },
            newAccount,
          },
        },
      } = await mutations.signup(creds)
      return { mail, newAccount }
    })
    .isDeeplyEqualTo({ mail: creds.mail, newAccount: true })

  await 'after signing up we can retrieve the user infos'
    .because(async () => {
      const {
        me: { mail },
      } = await queries.me()
      return mail
    })
    .isEqualTo(creds.mail)

  await 'signing out should succeed'
    .because(async () => {
      const {
        authenticate: { signout },
      } = await mutations.signout()
      return signout
    })
    .isEqualTo('Bye.')

  await 'retrieving user infos should throw a cookie error after signing out'
    .because(async () => {
      try {
        await queries.me()
      } catch (error) {
        return error.message.split(':')[0]
      }
      return 'no error was thrown'
    })
    .isEqualTo('Cookies are invalid or missing')

  await 'we should be able to signin with the previous registered account'
    .because(async () => {
      const {
        authenticate: {
          signin: {
            user: { mail },
            newAccount,
          },
        },
      } = await mutations.signin(creds)
      return { mail, newAccount }
    })
    .isDeeplyEqualTo({
      mail: creds.mail,
      newAccount: false,
    })

  await 'the account can be refreshed at any time to get a new access_token'
    .because(async () => {
      const {
        me: { refresh },
      } = await mutations.refresh()
      return refresh
    })
    .isEqualTo("And you're full of gas!")
})

'Signup errors'.doubt(async () => {
  await 'signing up with an invalid password format fails'
    .because(async () => {
      try {
        await mutations.signup({
          mail: 'granny@yopmail.adult',
          pwd: 'none',
          rememberMe: true,
        })
      } catch (error) {
        return error.message.split(':')[0]
      }
      return 'no error was thrown'
    })
    .isEqualTo(`Incorrect password format`)

  await 'signing up with an invalid mail format fails'
    .because(async () => {
      try {
        await mutations.signup({
          mail: 'none',
          pwd: 'admin1',
          rememberMe: true,
        })
      } catch (error) {
        return error.message.split(':')[0]
      }
      return 'no error was thrown'
    })
    .isEqualTo(`Incorrect mail format`)

  const creds = {
    mail: 'foo@bar.com',
    pwd: 'admin1',
    rememberMe: true,
  }
  await 'signing up twice should fail with a mail_already_used_error'
    .because(async () => {
      try {
        await mutations.signup(creds)
        await mutations.signup(creds)
      } catch (error) {
        return error.message.split(':')[0]
      }
      return 'no error was thrown'
    })
    .isEqualTo(`The mail address ${creds.mail} is already in use.`)
})

'Signin errors'.doubt(async () => {
  await 'signing in with an non existing account fails'
    .because(async () => {
      try {
        await mutations.signin({
          mail: 'idontexist@foo.com',
          pwd: 'admin23',
          rememberMe: true,
        })
      } catch (error) {
        return error.message.split(':')[0]
      }
      return 'no error was thrown'
    })
    .isEqualTo(`User not found`)

  await 'signing in with an invalid password format fails'
    .because(async () => {
      try {
        await mutations.signin({
          mail: 'harold@ok.boomer',
          pwd: 'none',
          rememberMe: true,
        })
      } catch (error) {
        return error.message.split(':')[0]
      }
      return 'no error was thrown'
    })
    .isEqualTo(`Incorrect password format`)

  await 'signing in with an invalid mail format fails'
    .because(async () => {
      try {
        await mutations.signin({
          mail: 'none',
          pwd: 'admin1',
          rememberMe: true,
        })
      } catch (error) {
        return error.message.split(':')[0]
      }
      return 'no error was thrown'
    })
    .isEqualTo(`Incorrect mail format`)
})

'Refresh errors'.doubt(async () => {
  await 'refreshing without being authenticated throws a cookie error'
    .because(async () => {
      try {
        await mutations.signout()
        await mutations.refresh()
      } catch (error) {
        return error.message.split(':')[0]
      }
      return 'no error was thrown'
    })
    .isEqualTo('Cookies are invalid or missing')
})
