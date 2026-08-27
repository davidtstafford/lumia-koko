const path = require('path');

module.exports = {
  cache: false,
  entry: {
    main: './src/main/main.ts',
    preload: './src/main/preload.ts'
  },
  target: 'electron-main',
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [{ loader: 'ts-loader', options: { configFile: 'tsconfig.main.json' } }]
      },
      {
        test: /\.node$/,
        loader: 'node-loader'
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  node: {
    __dirname: false,
    __filename: false
  },
  externals: {
    'better-sqlite3': 'commonjs better-sqlite3',
    'zlib-sync': 'commonjs zlib-sync',
    'bufferutil': 'commonjs bufferutil',
    'utf-8-validate': 'commonjs utf-8-validate',
    'kokoro-js': 'kokoro-js',
    '@huggingface/transformers': '@huggingface/transformers',
    'onnxruntime-node': 'commonjs onnxruntime-node'
  }
};
