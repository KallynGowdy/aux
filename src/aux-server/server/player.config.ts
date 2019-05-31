import { ClientConfig } from './config';
import * as process from 'process';

const config: ClientConfig = {
    index: 'player.html',
    web: {
        isBuilder: false,
        isPlayer: true,
        sentryDsn: process.env.SENTRY_DSN,
    },
};

export default config;
