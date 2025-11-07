import me from './resolvers/me.js'
import create_user from './resolvers/create_user.js'
import create_session from './resolvers/create_session.js'
import invite_user from './resolvers/invite_user.js'
import refresh_session from './resolvers/refresh_session.js'
import create_pwd_reset_code from './resolvers/create_pwd_reset_code.js'

import create_account_confirm_code from './resolvers/create_account_confirm_code.js'
import update_pwd from './resolvers/update_pwd.js'
import update_pwd_logged from './resolvers/update_pwd_logged.js'
import confirm_account from './resolvers/confirm_account.js'
import delete_session from './resolvers/delete_session.js'
import admin_delete_users from './resolvers/admin_delete_users.js'
import admin_update_pwd from './resolvers/admin_update_pwd.js'
import { ENVIRONMENT } from './constant.js'

export default {
  ping: () => 'pong',
  public_key: () => ENVIRONMENT.PUBLIC_KEY,
  me,
  create_user,
  create_session,
  invite_user,
  refresh_session,
  create_pwd_reset_code,
  create_account_confirm_code,
  update_pwd,
  confirm_account,
  delete_session,
  admin_delete_users,
  admin_update_pwd,
  update_pwd_logged,
}
