import test from 'node:test';
import assert from 'node:assert/strict';

const loadEnvModule = async (envOverrides = {}) => {
  const originalEnv = { ...process.env };

  try {
    for (const [key, value] of Object.entries(envOverrides)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    const moduleUrl = new URL(`../src/config/env.js?cacheBust=${Date.now()}${Math.random()}`, import.meta.url);
    const module = await import(moduleUrl.href);
    return module.config;
  } finally {
    process.env = { ...originalEnv };
  }
};

test('serveStatic respects an explicit true in production', async () => {
  const config = await loadEnvModule({ NODE_ENV: 'production', SERVE_STATIC: 'true' });
  assert.equal(config.serveStatic, true);
});

test('serveStatic respects an explicit false in production', async () => {
  const config = await loadEnvModule({ NODE_ENV: 'production', SERVE_STATIC: 'false' });
  assert.equal(config.serveStatic, false);
});
