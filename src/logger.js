import pino from 'pino';
import { appConfig } from './config.js';

export const logger = pino({
  level: appConfig.env === 'production' ? 'info' : 'debug',
  transport:
    appConfig.env === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
});
