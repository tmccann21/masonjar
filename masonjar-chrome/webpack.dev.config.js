const path = require('path');
const webpack = require('webpack');

const CopyPlugin = require('copy-webpack-plugin');

const EnvPlugin = new webpack.DefinePlugin({
  'process.env':{
    'LOG_LEVEL': JSON.stringify('INFO'),
    'SOCKET_URL': JSON.stringify('ws://localhost:8008')
  }
});

const removeSrcDir = (targetPath) =>
  Promise.resolve(targetPath.replace(/src\//i, ''));

module.exports = {
  entry: {
    content: './src/content.ts',
    background: './src/background.ts',
    popup: './src/views/popup.ts',
  },
  devtool: 'inline-source-map',
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.ts$/i,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ]
  },
  plugins: [
    EnvPlugin,
    new CopyPlugin({
      patterns: [
        {
          from: 'src/**/*.html',
          to: './',
          transformPath: removeSrcDir,
        },
        {
          from: 'src/**/*.png',
          to: './',
          transformPath: removeSrcDir,
        },
        {
          from: 'src/**/*.css',
          to: './',
          transformPath: removeSrcDir,
        },
        { from: 'src/manifest.dev.json', to: './manifest.json' },
      ],
    }),
  ],
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dev'),
  },
};
