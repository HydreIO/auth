import version from 'project-version'
import Debug from 'debug'

const debug = Debug('auth').extend('query')

export const ping = () => 'subscribe to pewdiepie'
export const cert = (_, __, { env: { PUB_KEY } }) => PUB_KEY
export const me = async (_, __, { getUser }) => {
  debug('......asking identity')
  const { uuid, mail, sessions, verified } = await getUser()
  debug('......user was found')
  return { uuid, mail, sessions, verified }
}
