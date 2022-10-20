const path              = require('path');


module.exports = {
    target   : 'node-webkit',
    mode     : 'development',
    entry    : './src/index.js',
    externals: {
        sqlite3: 'commonjs sqlite3',
    },
    output   : {
        filename: 'tangled-advertisement.js',
        path    : path.resolve(__dirname, 'lib')
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
    }
};
