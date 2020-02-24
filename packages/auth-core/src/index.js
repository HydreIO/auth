import { buildContext } from './core/context'

export const createContext = opt => buildContext(opt)
export { default as schema } from './graphql/index'
export { default as events } from './core/utils/events'
export { formatError } from './graphql/errors'
export * from './core/utils/constant'