const path = require('path');

module.exports = {
    mount: {
        'aux-web': '/_dist_',
        shared: '/_shared_',
        snowpack: '/',
    },
    plugins: [
        [
            'snowpack-plugin-raw-file-loader',
            {
                exts: ['.txt'], // Add file extensions saying what files should be loaded as strings in your snowpack application. Default: '.txt'
            },
        ],
        '@casual-simulation/snowpack-plugin-vue2',
    ],
    devOptions: {
        open: 'none',
    },
    installOptions: {
        installTypes: true,
    },
    alias: {
        'vue-json-tree-view': path.resolve(
            __dirname,
            'aux-web/shared/public/VueJsonTreeView/index.ts'
        ),
        'three-legacy-gltf-loader': path.resolve(
            __dirname,
            'aux-web/shared/public/three-legacy-gltf-loader/LegacyGLTFLoader.js'
        ),
        'three-vrcontroller-module': path.resolve(
            __dirname,
            'aux-web/shared/public/three-vrcontroller-module/VRController.js'
        ),
        callforth: path.resolve(
            __dirname,
            './aux-web/shared/public/callforth/index.js'
        ),
        'vue-qrcode-reader': path.resolve(
            __dirname,
            './aux-web/shared/public/vue-qrcode-reader'
        ),
        'clipboard-polyfill': path.resolve(
            __dirname,
            'aux-web/shared/public/clipboard-polyfill/clipboard-polyfill.js'
        ),
    },
};
