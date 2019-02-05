import * as Sentry from '@sentry/browser';
import Vue from 'vue';
import VueRouter, { RouteConfig } from 'vue-router';
import { 
    MdButton, 
    MdContent, 
    MdApp, 
    MdCard, 
    MdToolbar, 
    MdField, 
    MdProgress, 
    MdDrawer, 
    MdList, 
    MdMenu, 
    MdDialog, 
    MdDialogConfirm,
    MdDialogAlert,
    MdTabs,
    MdCheckbox,
    MdTooltip,
    MdSnackbar,
    MdSwitch,
    MdBadge,
} from 'vue-material/dist/components';
import 'vue-material/dist/vue-material.min.css';
import 'vue-material/dist/theme/default.css';
import 'pepjs'; // Polyfill for pointer events
import { polyfill } from 'es6-promise';

import { appManager } from './AppManager';
import App from './App/App';
import Welcome from './Welcome/Welcome';
import Home from './Home/Home';
import Editor from './Editor/Editor';
import MergeConflicts from './MergeConflicts/MergeConflicts';

// Setup the Promise shim for browsers that don't support promises.
polyfill();

Vue.use(VueRouter);
Vue.use(MdButton);
Vue.use(MdCheckbox);
Vue.use(MdContent);
Vue.use(MdApp);
Vue.use(MdCard);
Vue.use(MdToolbar);
Vue.use(MdField);
Vue.use(MdProgress);
Vue.use(MdDrawer);
Vue.use(MdList);
Vue.use(MdMenu);
Vue.use(MdDialog);
Vue.use(MdDialogConfirm);
Vue.use(MdDialogAlert)
Vue.use(MdTabs);
Vue.use(MdTooltip);
Vue.use(MdSnackbar);
Vue.use(MdSwitch);
Vue.use(MdBadge);

const routes: RouteConfig[] = [
    {
        path: '/login',
        name: 'login',
        component: Welcome,
    },
    {
        path: '/:id?',
        name: 'home',
        component: Home,
    },
    {
        path: '/editor/:id?',
        name: 'editor',
        component: Editor
    },
    {
        path: '/merge-conflicts/:id?',
        name: 'merge-conflicts',
        component: MergeConflicts,
        beforeEnter: (to, from, next) => {
            if (appManager.fileManager && appManager.fileManager.mergeStatus) {
                next();
            } else {
                next({ name: 'home', params: { id: appManager.user.channelId } });
            }
        }
    }
]

const router = new VueRouter({
    mode: 'history',
    routes
});

router.beforeEach((to, from, next) => {
    appManager.initPromise.then(() => {
        const channelId = to.params.id || null;
        if (to.path !== '/login') {
            if (!appManager.user) {
                next({ name: 'login', query: { id: channelId } });
                return;
            } else {
                if (appManager.user.channelId != channelId) {
                    return appManager.loginOrCreateUser(appManager.user.email, channelId).then(() => {
                        location.reload();
                        next();
                    }, ex => {
                        console.error(ex);
                        next({ name: 'login', query: { id: channelId } });
                    });
                }
            }
        } else {
            if (appManager.user) {
                next({ name: 'home', params: { id: appManager.user.channelId }});
                return;
            }
        }
        next();
    }, ex => {
        console.error(ex);
        next({ name: 'login' });
    });
});

const app = new Vue({
    router,
    render: createEle => createEle(App)
}).$mount('#app');
