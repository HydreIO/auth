const path = require('path')
const nodeExternals = require('webpack-node-externals')
const slsw = require('serverless-webpack')

module.exports = {
  externals: [nodeExternals(), 'aws-sdk'],
  entry: slsw.lib.entries,
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader'
          }
        ]
      },
      {
        test: /\.(graphql|gql)$/,
        exclude: /node_modules/,
        loader: 'graphql-tag/loader'
      }
    ]
  },
  optimization: {
    minimize: process.env.LOCALHOST.toLowerCase() === 'true'
  },
  output: {
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, '.webpack'),
    filename: '[name]',
    sourceMapFilename: '[file].map'
  }

}