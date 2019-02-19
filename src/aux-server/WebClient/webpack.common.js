const childProcess = require('child_process');
const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const OfflinePlugin = require('offline-plugin');
const webpack = require('webpack');

const commitHash = childProcess.execSync('git rev-parse HEAD').toString().trim();
const latestTag = childProcess.execSync('git describe --abbrev=0 --tags').toString().trim();

const auxCommon = path.resolve(__dirname, '..', '..', 'aux-common');

module.exports = {
  entry: path.resolve(__dirname, 'index.ts'),
  output: {
    publicPath: '/',
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /formula\-lib/,
        use: 'raw-loader'
      },
      {
        test: /\.vue$/,
        use: 'vue-loader',
        exclude: /node_modules/
      },
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        include: [__dirname],
        exclude: /node_modules/,
      },
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        include: [auxCommon],
        exclude: /node_modules/,
        options: {
          instance: 'common',
          configFile: path.resolve(auxCommon, 'tsconfig.json')
        }
      },
      {
        test: /\.css$/,
        use: ['vue-style-loader', 'css-loader'],
      },
      {
        test: /\.svg$/,
        use: 'vue-svg-loader'
      },
      {
        test: /von-grid.min.js$/,
        use: 'exports-loader?vg=vg'
      },
      {
        test: /\.(png|jpg|gif|gltf)$/,
        use: [
          {
            loader: 'file-loader',
            options: {}
          }
        ]
      },
      {
        test: /three\/examples\/js/,
        use: 'imports-loader?THREE=three'
      }
    ]
  },
  resolve: {
    extensions: ['.vue', '.ts', '.js', '.css'],
    alias: {
      'three-examples': path.join(__dirname, '../node_modules/three/examples/js'),
      'fs': 'browserfs',
      'aux-common/Formulas/formula-lib': path.resolve(__dirname, '..', '..', 'aux-common/Formulas/formula-lib.ts'),
      'webxr-polyfill': path.resolve(__dirname, 'public/scripts/webxr-polyfill.js')
    }
  },
  plugins: [
    new CleanWebpackPlugin([
      path.resolve(__dirname, 'dist')
    ]),
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({
      template: 'WebClient/index.html',
      title: 'File Simulator'
    }),
    new webpack.ProvidePlugin({
      THREE: 'three',
    }),
    new webpack.DefinePlugin({
      GIT_HASH: JSON.stringify(commitHash),
      GIT_TAG: JSON.stringify(latestTag),
      SENTRY_DSN: JSON.stringify('***REMOVED***'),
    }),
    new OfflinePlugin({
      appShell: '/',
      AppCache: false,
      ServiceWorker: {
        events: true
      },
      externals: [
        'https://fonts.googleapis.com/css?family=Roboto:400,500,700,400italic|Material+Icons'
      ]
    })
  ]
};