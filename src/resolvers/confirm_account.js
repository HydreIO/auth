import { ERRORS, ENVIRONMENT } from '../constant.js'
import { GraphQLError } from 'graphql'
import Token from '../token.js'
import { jwtVerify, importSPKI } from 'jose'
import { user_db } from '../database.js'

// Import public key using jose
const public_key = await importSPKI(ENVIRONMENT.PUBLIC_KEY, 'ES512')

const is_token_valid = async (token, valid_uuid) => {
  try {
    const { payload } = await jwtVerify(token, public_key)

    return payload.uuid === valid_uuid
  } catch {
    return false
  }
}

export default async ({ code }, { koa_context, redis, force_logout }) => {
  const bearer = await Token(koa_context).get()

  if (!bearer.uuid) throw new GraphQLError(ERRORS.USER_NOT_FOUND)

  const user = await user_db.find_by_uuid(redis, bearer.uuid)

  /* c8 ignore next 5 */
  // redundant testing as the same code is already tested elsewhere
  if (!user) {
    force_logout()
    throw new GraphQLError(ERRORS.USER_NOT_FOUND)
  }

  // codes expire after a day
  if (!(await is_token_valid(code, bearer.uuid)))
    throw new GraphQLError(ERRORS.INVALID_CODE)

  await user_db.update(redis, bearer.uuid, { verified: true })
  return true
}
