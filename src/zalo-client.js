import qrcode from 'qrcode-terminal';
import { Zalo, LoginQRCallbackEventType } from 'zca-js';
import { appConfig } from './config.js';
import { logger } from './logger.js';
import { loadSession, saveQrPayload, saveSession } from './session-store.js';

async function buildSessionFromApi(api, fallback = null) {
  const jar = api.getCookie();
  const cookies = jar.serializeSync().cookies;
  const account = await api.fetchAccountInfo();

  return {
    imei: api.ctx?.imei || fallback?.imei || '',
    userAgent: api.ctx?.userAgent || fallback?.userAgent || '',
    language: api.ctx?.language || fallback?.language || 'vi',
    cookie: cookies,
    account,
    savedAt: new Date().toISOString(),
  };
}

export async function connectZalo(qrState) {
  const zalo = new Zalo();
  const previousSession = await loadSession();
  let provisionalSession = previousSession;

  if (previousSession?.cookie?.length && previousSession?.imei && previousSession?.userAgent) {
    logger.info(
      {
        sessionPath: appConfig.sessionPath,
        cookieCount: previousSession.cookie.length,
        savedAt: previousSession.savedAt,
      },
      'Trying to restore Zalo session from disk',
    );
    try {
      const api = await zalo.login({
        imei: previousSession.imei,
        userAgent: previousSession.userAgent,
        language: previousSession.language || 'vi',
        cookie: previousSession.cookie,
      });
      const refreshedSession = await buildSessionFromApi(api, previousSession);
      await saveSession(refreshedSession);
      logger.info({ sessionPath: appConfig.sessionPath }, 'Zalo session restored from disk');
      return api;
    } catch (error) {
      logger.warn({ err: error, sessionPath: appConfig.sessionPath }, 'Failed to restore Zalo session, falling back to QR login');
    }
  }

  logger.info('Starting Zalo QR login flow');
  const api = await zalo.loginQR(
    {
      qrPath: appConfig.qrPath,
    },
    async (event) => {
      switch (event.type) {
        case LoginQRCallbackEventType.QRCodeGenerated: {
          logger.info('QR generated. Scan with Zalo app.');
          qrcode.generate(event.data.code, { small: true });
          const payload = {
            type: 'generated',
            code: event.data.code,
            image: `data:image/png;base64,${event.data.image}`,
            token: event.data.token,
            at: new Date().toISOString(),
          };
          qrState?.set(payload);
          await saveQrPayload(payload);
          break;
        }
        case LoginQRCallbackEventType.QRCodeScanned: {
          const payload = {
            type: 'scanned',
            user: event.data.display_name,
            avatar: event.data.avatar,
            at: new Date().toISOString(),
          };
          qrState?.set(payload);
          await saveQrPayload(payload);
          logger.info({ user: event.data.display_name }, 'QR scanned, waiting for confirmation');
          break;
        }
        case LoginQRCallbackEventType.QRCodeExpired: {
          const payload = { type: 'expired', at: new Date().toISOString() };
          qrState?.set(payload);
          await saveQrPayload(payload);
          logger.warn('QR expired, library may regenerate a new one');
          break;
        }
        case LoginQRCallbackEventType.QRCodeDeclined: {
          const payload = { type: 'declined', code: event.data.code, at: new Date().toISOString() };
          qrState?.set(payload);
          await saveQrPayload(payload);
          logger.warn('QR login declined from mobile app');
          break;
        }
        case LoginQRCallbackEventType.GotLoginInfo: {
          provisionalSession = {
            imei: event.data.imei,
            userAgent: event.data.userAgent,
            language: 'vi',
            cookie: event.data.cookie,
            savedAt: new Date().toISOString(),
          };
          await saveSession(provisionalSession);
          const payload = { type: 'authorized', at: new Date().toISOString() };
          qrState?.set(payload);
          await saveQrPayload(payload);
          logger.info({ sessionPath: appConfig.sessionPath }, 'Received login info and persisted preliminary session');
          break;
        }
      }
    },
  );

  const enrichedSession = await buildSessionFromApi(api, provisionalSession);
  await saveSession(enrichedSession);
  logger.info(
    {
      sessionPath: appConfig.sessionPath,
      cookieCount: enrichedSession.cookie.length,
      savedAt: enrichedSession.savedAt,
    },
    'Zalo QR login completed and session saved',
  );
  return api;
}
