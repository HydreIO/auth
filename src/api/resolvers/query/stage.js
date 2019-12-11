import version from 'project-version'

export default () => ({ stage: process.env.STAGE, version })
