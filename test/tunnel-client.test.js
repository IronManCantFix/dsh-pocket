// 隧道自愈的客户端接线（上游 3c89245 / #215）：status 透出就绪快照、UI 认识
// restarting 相位并给出「停止重连」出口、词典补齐。主机侧状态机见 service-health.test.js。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { redactStatus } from '../client/api.js';
import { zh, en } from '../client/pocket-locales.js';

test('redactStatus 透出 tunnelHealth（自愈排障快照，不含敏感信息）', () => {
  const health = { phase: 'restarting', consecutiveFailures: 2, restarts: 1, readyConnections: 0, checkedAt: 123 };
  const out = redactStatus({ tunnelHealth: health });
  assert.deepEqual(out.tunnelHealth, health, 'status 里的就绪快照要原样透出给设置页');
  assert.equal(redactStatus({}).tunnelHealth, null, '没有快照时为 null，前端按旧行为渲染');
});

test('设置页认识 restarting 相位，并提供「停止重连」出口', () => {
  const src = readFileSync(new URL('../client/index.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes("=== 'restarting'"), '要识别自愈重建的 restarting 相位');
  assert.ok(src.includes("t('stopReconnect')"), '自动重连期间要能取消，不能只能干等');
  assert.ok(src.includes("t('reconnecting')"), '重连中要有明确文案');
  // 重连中旧地址已失效，不能同时展示二维码/地址
  assert.ok(
    /tunnelRestarting\s*\n?\s*\?\s*h\('button'/.test(src),
    'restarting 时按钮要切换为停止重连',
  );
});

test('中英词典补齐 reconnecting / stopReconnect', () => {
  for (const [name, dict] of [['zh', zh], ['en', en]]) {
    assert.ok(dict.reconnecting && dict.reconnecting.length > 2, name + ' 要有 reconnecting');
    assert.ok(dict.stopReconnect && dict.stopReconnect.length > 2, name + ' 要有 stopReconnect');
  }
});
