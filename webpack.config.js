const path = require('path')
const nodeExternals = require('webpack-node-externals')

module.exports = {
	externals: [nodeExternals(),'aws-sdk'],
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
	}
}