const childProcess = require('child_process');
const path = require('path');
const process = require('process');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const OfflinePlugin = require('offline-plugin');
const webpack = require('webpack');

const commitHash = childProcess
    .execSync('git rev-parse HEAD')
    .toString()
    .trim();
const latestTag = childProcess
    .execSync('git describe --abbrev=0 --tags')
    .toString()
    .trim();

module.exports = {
    entry: {
        projector: path.resolve(__dirname, 'aux-projector', 'index.ts'),
        player: path.resolve(__dirname, 'aux-player', 'index.ts'),
        worker: path.resolve(
            __dirname,
            'shared',
            'worker',
            'Simulation.plugin.ts'
        ),
    },
    output: {
        publicPath: '/',
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
    },
    node: {
        console: false,
        global: true,
        process: false,
        __filename: 'mock',
        __dirname: 'mock',

        // Buffer is needed for sha.js
        Buffer: true,
        setImmediate: false,
    },
    module: {
        rules: [
            // TODO: Re-enable sometime
            //   {
            //     test: /\.worker\.ts$/,
            //     use: 'worker-loader'
            //   },
            {
                test: /\.vue$/,
                use: {
                    loader: 'vue-loader',
                    options: {
                        transformAssetUrls: {
                            video: ['src', 'poster'],
                            source: ['src', 'srcset'],
                            img: 'src',
                            image: ['xlink:href', 'href'],
                            use: ['xlink:href', 'href'],
                        },
                    },
                },
                exclude: /node_modules/,
            },
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                include: [__dirname],
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ['vue-style-loader', 'css-loader'],
            },
            {
                test: /\.svg$/,
                use: 'vue-svg-loader',
            },
            {
                test: /von-grid.min.js$/,
                use: 'exports-loader?vg=vg',
            },
            {
                test: /\.(png|jpg|gif|gltf|webp)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {},
                    },
                ],
            },
            {
                test: /\.(ttf|woff|woff2)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: './fonts/[name].[ext]',
                        },
                    },
                ],
            },
            {
                test: /three\/examples\/js/,
                use: 'imports-loader?THREE=three',
            },
            {
                test: /\.js$/,
                use: ['source-map-loader'],
                include: [/aux-common/],
                enforce: 'pre',
            },
        ],
    },
    resolve: {
        extensions: ['.vue', '.js', '.ts', '.css'],
        alias: {
            'webxr-polyfill': path.resolve(
                __dirname,
                'aux-projector/public/scripts/webxr-polyfill.js'
            ),
            'vue-json-tree-view': path.resolve(
                __dirname,
                'shared/public/VueJsonTreeView/index.ts'
            ),
        },
    },
    plugins: [
        new CleanWebpackPlugin([path.resolve(__dirname, 'dist')]),
        new VueLoaderPlugin(),
        new HtmlWebpackPlugin({
            chunks: ['projector', 'vendors'],
            // inject: false,
            template: path.resolve(__dirname, 'aux-projector', 'index.html'),
            title: 'AUX Builder',
            filename: 'projector-index.html',
        }),
        new HtmlWebpackPlugin({
            chunks: ['player', 'vendors'],
            // inject: false,
            template: path.resolve(__dirname, 'aux-player', 'index.html'),
            title: 'AUX Player',
            filename: 'player-index.html',
        }),
        new webpack.ProvidePlugin({
            THREE: 'three',
        }),
        new webpack.DefinePlugin({
            GIT_HASH: JSON.stringify(commitHash),
            GIT_TAG: JSON.stringify(latestTag),
            SENTRY_DSN: JSON.stringify(process.env.SENTRY_DSN),
        }),
        new OfflinePlugin({
            // chunks: ['player'],
            appShell: '/',
            AppCache: false,
            ServiceWorker: {
                events: true,
                entry: path.resolve(__dirname, 'shared', 'sw.ts'),
            },
            rewrites: function(asset) {
                if (asset.endsWith('projector-index.html')) {
                    return '/';
                } else if (asset.endsWith('player-index.html')) {
                    return '/';
                }

                return asset;
            },
            externals: [
                'https://fonts.googleapis.com/css?family=Roboto:400,500,700,400italic|Material+Icons',
            ],
        }),
        // new OfflinePlugin({
        //   chunks: ['projector'],
        //   appShell: '/',
        //   AppCache: false,
        //   ServiceWorker: {
        //     events: true
        //   },
        //   externals: [
        //     'https://fonts.googleapis.com/css?family=Roboto:400,500,700,400italic|Material+Icons'
        //   ]
        // })
    ],
};
