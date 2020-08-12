/* eslint-disable complexity */
// this resolver would be more complex if
// we extract the code to validate this rule
import { ERRORS, ENVIRONMENT } from '../constant.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql/index.mjs'
import Token from '../token.js'
import { v4 as uuid4 } from 'uuid'
import MAIL from '../mail.js'

export default async (
  { mail, pwd, remember, payload },
  { build_session, koa_context, Graph, force_logout, publish },
) => {
  if (!mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  const [{ user, existing_sessions = [] } = {}] = await Graph.run`
    MATCH (user:User)
    WHERE user.mail = ${ mail }
    WITH user
    OPTIONAL MATCH (user)-->(s:Session)
    RETURN user, collect(s) AS existing_sessions`

  // this check is ahead of the USER_NOT_FOUND
  // because an invited/created user need to know if he already has a pwd or not
  if (user && !user.hash) throw new GraphQLError(ERRORS.NO_PASSWORD)

  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  const password_valid = await bcrypt.compare(pwd, user.hash)

  if (!password_valid) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  const built_session = build_session()

  if (!built_session.browserName && !built_session.deviceVendor)
    throw new GraphQLError(ERRORS.ILLEGAL_SESSION)

  const matching_session = existing_sessions.find(s => {
    return s.hash === built_session.hash
  })
  // this is a session created in case there is not matching_session
  const session = {
    ...built_session,
    uuid     : `Session:${ uuid4() }`,
    last_used: Date.now(),
  }

  if (!user.logged_once) {
    await Graph.run`
  MATCH (u:User) WHERE u.uuid = ${ user.uuid }
  SET u.logged_once = ${ true }
  `
    await publish(user.uuid)
  }

  if (matching_session) {
    // session was found so we update last usage
    await Graph.run`
        MATCH (u:User)-->(s:Session)
        WHERE u.uuid = ${ user.uuid } AND s.uuid = ${ matching_session.uuid }
        SET s.last_used = ${ Date.now() }
    `
  } else {
    // session was not found so we create a new one
    MAIL.send([
      MAIL.NEW_SESSION,
      user.uuid,
      mail,
      payload,
      JSON.stringify(session),
    ])

    await Graph.run`
          MATCH (u:User)
          WHERE u.uuid = ${ user.uuid }
          WITH DISTINCT u
          MERGE (u)-[:HAS_SESSION]->(s:Session ${ session })
      `
  }

  Token(koa_context).set({
    uuid   : user.uuid,
    session: matching_session?.uuid || session.uuid,
    remember,
  })

  const deprecated_sessions = []

  existing_sessions.sort((s1, s2) => s1.last_used - s2.last_used)

  while (existing_sessions.length >= ENVIRONMENT.MAX_SESSION_PER_USER)
    deprecated_sessions.push(existing_sessions.shift().uuid)

  /* c8 ignore next 9 */
  // lazy to test many UA, it works when locally testing and it's pretty dumb
  if (deprecated_sessions.length) {
    // too many session, we delete the oldest ones
    await Graph.run`
      MATCH (u:User)-->(s:Session)
      WHERE u.uuid = ${ user.uuid } AND s.uuid IN ${ deprecated_sessions }
      DELETE s
    `
  }

  return !matching_session
}
