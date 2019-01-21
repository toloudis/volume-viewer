const CopyWebpackPlugin = require('copy-webpack-plugin');

const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');

const output_dir_name = 'demo2';
const index_html = './public2/index.html';
const entry_js = './public2/index.js';

module.exports = {
    entry: ['babel-polyfill', entry_js],
    output: {
        path: path.resolve(__dirname, output_dir_name),
        filename: 'image-viewer-ui.bundle.js',
        publicPath: ''
    },
    devtool: 'cheap-module-source-map',
    plugins: [
        new CleanWebpackPlugin([output_dir_name]),
        new HtmlWebpackPlugin({
            template: index_html
        }),
        new webpack.DefinePlugin({
            APP_VERSION: JSON.stringify(require("./package.json").version)
        }),
        new webpack.ProvidePlugin({
            THREE: 'three'
        }),
        // ignores a webcomponents dependency on a server side module since this is for front end only.
        // see: https://github.com/webcomponents/webcomponentsjs/issues/794
        new webpack.IgnorePlugin(/vertx/),
        new CopyWebpackPlugin(['public2'])
    ],
    resolve: {
        extensions: ['.js']
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                include: [
                    path.resolve(__dirname, 'public2')
                ],
                exclude: /node_modules/,
                use: 'babel-loader'
            },
            {
                test: /Worker\.js$/,
                use: 'worker-loader?inline=true'
            },
            {
                test: /\.(obj)$/,
                use: ['raw-loader?inline=true']
            },
            {
                test: /\.(png)$/,
                use: ['url-loader?inline=true']
            }
        ]
    }
};
