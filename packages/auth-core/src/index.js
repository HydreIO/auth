import { buildContext } from './core/context'
import * as constants from './core/utils/constant'
import makeSchema from './graphql/index'
import events from './core/utils/events'
import { formatError } from './graphql/errors'

export default ({ apollo, graphql }) => ({
  createContext: opt => buildContext(opt),
  schema: makeSchema({ ...apollo, ...graphql }),
  events,
  formatError,
  constants
})