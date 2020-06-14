import { PUBLIC_KEY } from './env.js'
import DISK from './disk.js'
import MAIL from './mail.js'
import { extract_fields } from 'graphql-extract'
import { v4 as uuid4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql/index.mjs'
import jwt from 'jsonwebtoken'

const provide = x => () => x
const invariant = (verify, message) => {
  if (!verify) throw new GraphQLError(message)
}

export default {
  ping: provide('pong'),
  cert: provide(PUBLIC_KEY),
  me  : async (_, { user_id }, me_infos) => {
    const user = await DISK.User({
      type  : DISK.GET,
      uuids : [user_id],
      fields: extract_fields(me_infos),
    })

    return {
      ...user,
      sessions: async (__, ___, s_infos) =>
        DISK.Session({
          type  : DISK.GET,
          uuids : user.sessions,
          fields: extract_fields(s_infos),
        }),
    }
  },
  create_user: async ({ credentials }, { MAIL_REGEX, PWD_REGEX }) => {
    const { mail, pwd } = credentials

    invariant(mail && mail.match(MAIL_REGEX), `Address ${ mail } is invalid`)
    invariant(pwd ? pwd.match(PWD_REGEX) : true, 'Password [hidden] is invalid')

    if (
      await DISK.User({
        type : DISK.EXIST,
        match: { mail },
      })
    )
      throw new GraphQLError('Email already in use')
    if (!pwd) await MAIL.reset(mail)

    await DISK.User({
      type  : DISK.CREATE,
      fields: {
        mail,
        uuid    : uuid4(),
        hash    : pwd ? await bcrypt.hash(pwd, 10) : undefined,
        verified: false,
        sessions: [],
      },
    })
    return true
  },
  create_session: async (
    { credentials } = {},
    { user_id, session, PRIVATE_KEY, access_token_expiration },
  ) => {
    invariant(session.browserName || session.deviceVendor, 'Invalid user agent')

    if (!credentials) {
      // logged
      invariant(user_id, 'User not found')

      const user = await DISK.User({
        type  : DISK.GET,
        match : { uuid: user_id },
        fields: ['sessions'],
      })

      invariant(user, 'User not found')

      const session_found = await DISK.Session({
        type  : DISK.EXIST,
        filter: { uuids: [user.sessions] },
        match : { hash: session.hash },
      })

      invariant(session_found, 'Session not found')

      jwt.sign({}, PRIVATE_KEY, {
        algorithm: 'ES512',
        expiresIn: access_token_expiration, // auto verified by jsonwebtoken lib
        audience : 'auth::service', // not really used yet
        issuer   : 'auth::service', // should be verified
        // used to verify that the session wasn't revoked
        jwtid    : session.hash, // should be verified
        subject  : user_id,
        // mutatePayload: true
      })

      return false
    }

    const { mail, pwd, remember_me } = credentials
    const user = await DISK.User({
      type  : DISK.GET,
      match : { mail },
      fields: [], // no fields as we just want to check for existing
    })

    bcrypt.compare(pwd, hash)
  },
}
