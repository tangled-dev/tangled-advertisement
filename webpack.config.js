const path       = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    target   : 'node',
    mode     : 'development',
    entry    : './src/index.js',
    output   : {
        filename: 'tangled-advertisement.js',
        path    : path.resolve(__dirname, 'lib')
    },
    resolve: {
        alias: {
            [path.join(__dirname, 'node_modules/sqlite3/lib/sqlite3-binding.js')]: path.join(__dirname, 'src/database/sqlite3/sqlite3-binding.js')
        }
    },
    devtool  : 'inline-source-map',
    module   : {
        rules: [
            {
                test: /\.m?js$/,
                exclude: /node_modules/,
                use    : {
                    loader : 'babel-loader',
                    options: {
                        presets    : [
                            '@babel/preset-env'
                        ],
                        plugins    : [
                            '@babel/plugin-proposal-class-properties'
                        ],
                        sourceMaps : 'inline',
                        retainLines: true
                    }
                }
            },
            {
                test: /\.sql/,
                type: 'asset/source',
            }
        ]
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: 'node_modules/sqlite3/build/**/node_sqlite3.node',
                    to  : 'build/node_sqlite3.node'
                }
            ]
        })
    ]
};
