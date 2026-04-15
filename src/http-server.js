import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import cookie from 'cookie';
import multer from 'multer';
import path from 'node:path';
import { appConfig } from './config.js';
import { buildAccessUrls, getIPv4Addresses, getWindowsIPv4Addresses, isWSL } from './network-info.js';

function makeSessionToken() {
  return crypto.randomBytes(24).toString('hex');
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

export function createHttpServer({ state, conversations, simulateMessage, messageStore, getSettings, updateSettings, qrState, manualReply, resolveName, resolveGroupName, logBuffer, disconnectZalo, reconnectZalo }) {
  const app = express();
  const sessions = new Map();

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  function parseCookies(req) {
    return cookie.parse(req.headers.cookie || '');
  }

  function isAuthed(req) {
    const cookies = parseCookies(req);
    return cookies.admin_session && sessions.has(cookies.admin_session);
  }

  function requireAuth(req, res, next) {
    if (req.path === '/login' || req.path === '/api/login') return next();
    if (req.path.startsWith('/assets/')) return next();
    if (req.path === '/' && !isAuthed(req)) {
      return res.redirect('/login');
    }
    if (req.path.startsWith('/api/') && !isAuthed(req)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (!req.path.startsWith('/api/') && !isAuthed(req)) {
      return res.redirect('/login');
    }
    return next();
  }

  app.use(requireAuth);
  app.use('/assets', express.static(appConfig.publicDir));
  app.use('/uploads', express.static(path.join(appConfig.dataDir, 'uploads')));

  app.get('/login', (_req, res) => {
    res.sendFile('login.html', { root: appConfig.publicDir });
  });

  app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (username !== appConfig.adminUsername || password !== appConfig.adminPassword) {
      return res.status(401).json({ ok: false, error: 'Sai tài khoản hoặc mật khẩu' });
    }

    const token = makeSessionToken();
    sessions.set(token, { username, at: Date.now() });
    res.setHeader(
      'Set-Cookie',
      cookie.serialize('admin_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 12,
      }),
    );
    return res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    const cookies = parseCookies(req);
    if (cookies.admin_session) sessions.delete(cookies.admin_session);
    res.setHeader(
      'Set-Cookie',
      cookie.serialize('admin_session', '', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      }),
    );
    res.json({ ok: true });
  });

  app.get('/', (_req, res) => {
    res.redirect('/dashboard');
  });

  app.get('/dashboard', (_req, res) => {
    res.sendFile('dashboard.html', { root: appConfig.publicDir });
  });

  app.get('/conversations', (_req, res) => {
    res.sendFile('conversations.html', { root: appConfig.publicDir });
  });

  app.get('/settings', (_req, res) => {
    res.sendFile('settings.html', { root: appConfig.publicDir });
  });

  app.get('/logs', (_req, res) => {
    res.sendFile('logs.html', { root: appConfig.publicDir });
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      env: appConfig.env,
      aiBackend: (state.settings && state.settings.aiBackend) || appConfig.aiBackend,
      zaloTransport: appConfig.zaloTransport,
      zalo: {
        connected: state.connected,
        ownId: state.ownId,
        account: state.account,
        loginStatus: state.loginStatus,
        loginError: state.loginError,
      },
      store: messageStore.stats(),
      conversations: conversations.stats(),
      runtime: {
        nodeVersion: process.version,
        recommendedNode: process.versions.node.startsWith('22.') ? 'ok' : 'prefer-node-22-lts',
        platform: process.platform,
        host: appConfig.host,
        port: appConfig.port,
        accessUrls: buildAccessUrls(appConfig.host, appConfig.port),
        ipv4: getIPv4Addresses(),
        windowsIpv4: getWindowsIPv4Addresses(),
        isWSL: isWSL(),
      },
      now: new Date().toISOString(),
    });
  });

  app.get('/api/settings', async (_req, res, next) => {
    try {
      res.json({ ok: true, settings: await getSettings() });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/settings', async (req, res, next) => {
    try {
      const settings = await updateSettings(req.body || {});
      state.settings = settings;
      res.json({ ok: true, settings });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/threads', async (_req, res) => {
    const threads = messageStore.listThreads(200);
    
    // Enrich threads with names if missing
    for (const t of threads) {
      if (!t.senderName && t.type === 'dm' && resolveName) {
        const name = await resolveName(t.threadId);
        if (name) t.senderName = name;
      }
      if (!t.groupName && t.type === 'group' && resolveGroupName) {
        const name = await resolveGroupName(t.threadId);
        if (name) {
          t.groupName = name;
          // Lưu ngược lại DB để lần sau không cần resolve nữa
          try {
            const lastMsg = messageStore.listMessages(t.threadId, 1)[0];
            if (lastMsg) {
              await messageStore.saveMessage({
                ...lastMsg,
                groupName: name,
                id: `fix-${t.threadId}` // ID đặc biệt để update
              });
            }
          } catch(e) {}
        }
      }
      t.displayName = t.type === 'group' ? (t.groupName || t.threadId) : (t.senderName || t.threadId);
    }
    
    res.json({ ok: true, threads });
  });

  app.get('/api/messages', (req, res) => {
    const threadId = req.query.threadId ? String(req.query.threadId) : '';
    res.json({ ok: true, messages: messageStore.listMessages(threadId, 200) });
  });

  app.get('/api/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(appConfig.dataDir, 'uploads', filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ ok: false, error: 'Image not found' });
    }
    
    res.sendFile(filepath);
  });

  app.delete('/api/threads/:threadId', async (req, res, next) => {
    try {
      const { threadId } = req.params;
      await messageStore.deleteThread(threadId);
      if (conversations && conversations.clearThread) {
        conversations.clearThread(threadId);
      }
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/qr', (_req, res) => {
    res.json({ ok: true, qr: qrState.get() });
  });

  app.get('/api/logs', (_req, res) => {
    res.json({ ok: true, logs: logBuffer.list(300) });
  });

  app.post('/api/manual-reply', upload.array('files'), async (req, res, next) => {
    try {
      const attachments = (req.files || []).map(file => ({
        data: file.buffer,
        filename: file.originalname,
        metadata: {
          totalSize: file.size,
        }
      }));

      const result = await manualReply({
        threadId: req.body.threadId,
        text: req.body.text,
        threadType: req.body.threadType,
        attachments
      });
      res.json({ ok: true, result });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/simulate', async (req, res, next) => {
    try {
      const result = await simulateMessage(req.body || {});
      res.json({ ok: true, result });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/zalo/logout', async (_req, res, next) => {
    try {
      const result = await disconnectZalo({ clearSavedSession: true });
      res.json({ ok: true, result });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/zalo/relogin', async (_req, res, next) => {
    try {
      const result = await reconnectZalo({ forceFresh: true });
      res.json({ ok: true, result });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    res.status(500).json({
      ok: false,
      error: error?.message || 'Unknown error',
    });
  });

  return app.listen(appConfig.port, appConfig.host, () => {
    console.log(`HTTP server listening on ${appConfig.host}:${appConfig.port}`);
    for (const url of buildAccessUrls(appConfig.host, appConfig.port)) {
      console.log(`- ${url}`);
    }
    if (isWSL()) {
      console.log('WSL detected: thử http://127.0.0.1:%s/dashboard từ Windows trước; nếu không được thì dùng IP Windows/LAN ở danh sách trên.', appConfig.port);
    }
  });
}
