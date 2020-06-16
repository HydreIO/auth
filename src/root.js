import me from './resolvers/me.js'
import create_user from './resolvers/create_user.js'
import create_session from './resolvers/create_session.js'
import refresh_session from './resolvers/refresh_session.js'
import create_pwd_reset_code from './resolvers/create_pwd_reset_code.js'
// eslint-disable-next-line max-len
import create_account_comfirm_code from './resolvers/create_account_comfirm_code.js'
import update_pwd from './resolvers/update_pwd.js'
import confirm_account from './resolvers/confirm_account.js'
import delete_session from './resolvers/delete_session.js'
import admin_delete_user from './resolvers/admin_delete_user.js'
import admin_update_pwd from './resolvers/admin_update_pwd.js'
import { ENVIRONMENT } from './constant.js'

export default {
  ping: () => 'pong',
  cert: () => ENVIRONMENT.PUBLIC_KEY,
  me,
  create_user,
  create_session,
  refresh_session,
  create_pwd_reset_code,
  create_account_comfirm_code,
  update_pwd,
  confirm_account,
  delete_session,
  admin_delete_user,
  admin_update_pwd,
}
