import { ERRORS, ENVIRONMENT, validate_email_whitelist } from '../constant.js'
import bcrypt from 'bcryptjs'
import { GraphQLError } from 'graphql'
import Token from '../token.js'
import { user_db } from '../database.js'
import { create_or_update_session } from '../session_gate.js'

export default async (
  { mail, pwd, remember, lang },
  { build_session, publish, koa_context, force_logout }
) => {
  if (!mail.match(ENVIRONMENT.MAIL_REGEX))
    throw new GraphQLError(ERRORS.MAIL_INVALID)

  if (!pwd.match(ENVIRONMENT.PWD_REGEX))
    throw new GraphQLError(ERRORS.PASSWORD_INVALID)

  // Validate email against whitelist
  try {
    validate_email_whitelist(mail)
  } catch (error) {
    throw new GraphQLError(error.message)
  }

  // Find user
  const user = await user_db.find_by_email(mail)

  // Check if user has password (for invited users)
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

  // Use shared session gate
  const { session_uuid, is_new_session } = await create_or_update_session({
    user_uuid: user.uuid,
    user_email: mail,
    session_data: built_session,
    lang,
    publish,
    should_mark_logged_once: !user.logged_once,
  })

  // Set JWT token
  await Token(koa_context).set({
    uuid: user.uuid,
    session: session_uuid,
    remember,
  })

  return is_new_session
}
