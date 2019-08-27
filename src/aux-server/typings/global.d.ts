declare module 'vue-material';
declare module 'vue-shortkey';
declare module 'vue-material/dist/components';
declare module '@chenfengyuan/vue-qrcode';
declare module 'vue-qrcode-reader';
declare module 'vue-filepond';
declare module 'filepond-plugin-file-validate-type';
declare module 'webxr-polyfill';
declare module 'jsbarcode';
declare module 'quagga';

declare module '*.jpg' {
    const url: string;
    export default url;
}

declare module '*.png' {
    const url: string;
    export default url;
}

declare module '*.gltf' {
    const url: string;
    export default url;
}

declare module '*.json' {
    const json: string;
    export default json;
}

declare module 'monaco-editor/esm/vs/editor/standalone/browser/simpleServices';

declare module 'downloadjs' {
    function download(data: any, fileName: string, mimeType: string): void;
    export default download;
}

declare var PRODUCTION: boolean;
declare var GIT_HASH: string;
declare var GIT_TAG: string;
