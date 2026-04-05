import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(moduleDir, '..');

loadEnv({ path: path.join(rootDir, '.env') });

const boolFromEnv = z
  .string()
  .optional()
  .transform((value) => {
    if (value == null || value === '') return undefined;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default('0.0.0.0'),
  AI_BACKEND: z.enum(['mock', 'openai', 'openrouter', 'ollama', 'custom']).default('mock'),
  ZALO_TRANSPORT: z.enum(['real', 'mock']).default('real'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_MODEL: z.string().default('openai/gpt-4.1-mini'),
  OLLAMA_BASE_URL: z.string().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().default('llama3.1:8b'),
  CUSTOM_AI_BASE_URL: z.string().default(''),
  CUSTOM_AI_API_KEY: z.string().optional().default(''),
  CUSTOM_AI_MODEL: z.string().default(''),
  OPENAI_SYSTEM_PROMPT: z
    .string()
    .default('Bạn là trợ lý Zalo riêng của Quang. Trả lời bằng tiếng Việt, ngắn gọn, thân thiện, đúng trọng tâm.'),
  ZALO_GROUP_REQUIRE_MENTION: boolFromEnv.default(true),
  ZALO_FIRST_GREETING: z.string().default('Công Quang xin chào 👋'),
  ZALO_INTRO_HINT: z
    .string()
    .default('Bạn có thể đặt tên cho bot và chọn vibe như dễ thương, lịch sự, hài hước, lầy nhẹ, lạnh lùng hoặc chuyên nghiệp.'),
  ZALO_SESSION_PATH: z.string().default('./storage/zalo-session.json'),
  ZALO_QR_PATH: z.string().default('./storage/zalo-qr.json'),
  SETTINGS_PATH: z.string().default('./storage/settings.json'),
  MESSAGES_JSON_PATH: z.string().default('./storage/messages.json'),
  SQLITE_PATH: z.string().default('./storage/messages.sqlite'),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().default('admin123'),
  ADMIN_SESSION_SECRET: z.string().default('change-me-please'),
  ZALO_DM_ALLOWLIST: z.string().optional().default(''),
  ZALO_DM_BLOCKLIST: z.string().optional().default(''),
  ZALO_GROUP_ALLOWLIST: z.string().optional().default(''),
  ZALO_GROUP_BLOCKLIST: z.string().optional().default(''),
});

function parseCsvList(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  );
}

const raw = schema.parse(process.env);

export const appConfig = {
  env: raw.NODE_ENV,
  port: raw.PORT,
  host: raw.HOST,
  aiBackend: raw.AI_BACKEND,
  zaloTransport: raw.ZALO_TRANSPORT,
  openaiApiKey: raw.OPENAI_API_KEY,
  openaiModel: raw.OPENAI_MODEL,
  openrouterApiKey: raw.OPENROUTER_API_KEY,
  openrouterModel: raw.OPENROUTER_MODEL,
  ollamaBaseUrl: raw.OLLAMA_BASE_URL,
  ollamaModel: raw.OLLAMA_MODEL,
  customAiBaseUrl: raw.CUSTOM_AI_BASE_URL,
  customAiApiKey: raw.CUSTOM_AI_API_KEY,
  customAiModel: raw.CUSTOM_AI_MODEL,
  openaiSystemPrompt: raw.OPENAI_SYSTEM_PROMPT,
  zaloGroupRequireMention: raw.ZALO_GROUP_REQUIRE_MENTION,
  zaloFirstGreeting: raw.ZALO_FIRST_GREETING,
  zaloIntroHint: raw.ZALO_INTRO_HINT,
  sessionPath: path.resolve(rootDir, raw.ZALO_SESSION_PATH),
  qrPath: path.resolve(rootDir, raw.ZALO_QR_PATH),
  settingsPath: path.resolve(rootDir, raw.SETTINGS_PATH),
  messagesJsonPath: path.resolve(rootDir, raw.MESSAGES_JSON_PATH),
  sqlitePath: path.resolve(rootDir, raw.SQLITE_PATH),
  adminUsername: raw.ADMIN_USERNAME,
  adminPassword: raw.ADMIN_PASSWORD,
  adminSessionSecret: raw.ADMIN_SESSION_SECRET,
  dmAllowlist: parseCsvList(raw.ZALO_DM_ALLOWLIST),
  dmBlocklist: parseCsvList(raw.ZALO_DM_BLOCKLIST),
  groupAllowlist: parseCsvList(raw.ZALO_GROUP_ALLOWLIST),
  groupBlocklist: parseCsvList(raw.ZALO_GROUP_BLOCKLIST),
  publicDir: path.resolve(rootDir, 'public'),
};

export function ensureRuntimeDirs() {
  for (const filePath of [appConfig.sessionPath, appConfig.qrPath, appConfig.settingsPath, appConfig.messagesJsonPath, appConfig.sqlitePath]) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
}
