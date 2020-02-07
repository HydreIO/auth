import { buildContext } from './core/context'

export const createContext = opt => buildContext(opt)
export schema from './graphql'
export events from './core/events'
export { formatError } from './graphql/errors'
export * from './core/constant'