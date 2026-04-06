const path = require('path');

module.exports = {
    mode: 'production',   // o 'development' per debug
    entry: {
        sidepanel: './js/sidepanel.js'
    },
    output: {
        filename: '[name].js',        
        path: path.resolve(__dirname, 'dist')
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: 'babel-loader'  // opzionale se vuoi compatibilità con vecchi JS
            }
        ]
    },
    resolve: {
        extensions: ['.js']
    }
};