// issue #79 回归：Tailscale/CGNAT（100.64/10）及用户手动「局域网地址」覆盖，应走局域网密码。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tokenForHost, isLanOverrideHost } from '../lib/index.js';
import { setLanIpOverride, setLanAuthEnabled, lanIpOverride } from '../lib/settings.mjs';

let tmpHome = null;
let savedHome = null;

function withTempHome(fn) {
  return (async () => {
    savedHome = process.env.DSH_HOME;
    tmpHome = await mkdtemp(join(tmpdir(), 'dsh-pocket-auth-'));
    process.env.DSH_HOME = tmpHome;
    try {
      return await fn();
    } finally {
      if (savedHome === undefined) delete process.env.DSH_HOME;
      else process.env.DSH_HOME = savedHome;
      if (tmpHome) await rm(tmpHome, { recursive: true, force: true });
    }
  })();
}

test('issue #79：手动「局域网地址」覆盖（公网段 IP）走局域网密码，而非公网密码', () => withTempHome(async () => {
  setLanAuthEnabled(true);
  setLanIpOverride('203.0.113.5'); // 故意用公网段 IP，证明覆盖优先级高于 classifyHost
  assert.equal(lanIpOverride(), '203.0.113.5');

  // 覆盖地址（带端口）→ 局域网 token
  const lanToken = tokenForHost('203.0.113.5:3081');
  // 普通公网域名（无覆盖命中）→ 公网 token
  const publicToken = tokenForHost('pocket.example.com');

  assert.notEqual(lanToken, publicToken, '覆盖地址必须比对局域网密码，而非公网密码');
  // 其它内网地址也走局域网 token（与覆盖地址一致）
  assert.equal(tokenForHost('192.168.1.5:3081'), lanToken, 'RFC1918 与覆盖地址共用局域网密码');
  // 公网路径不被覆盖误伤
  assert.equal(tokenForHost('8.8.8.8:3081'), publicToken, '普通公网 Host 仍走公网密码');

  // isLanOverrideHost 判定（带/不带端口）
  assert.equal(isLanOverrideHost('203.0.113.5:3081'), true);
  assert.equal(isLanOverrideHost('203.0.113.5'), true);
  assert.equal(isLanOverrideHost('192.168.1.5:3081'), false, '非覆盖地址不应命中');

  // 清空覆盖后恢复 classifyHost 语义（公网段 IP → 公网密码）
  setLanIpOverride('');
  assert.equal(isLanOverrideHost('203.0.113.5:3081'), false);
  assert.equal(tokenForHost('203.0.113.5:3081'), publicToken, '覆盖清空后回到公网判定');
}));

test('issue #79：CGNAT 100.64/10 无需覆盖即走局域网密码', () => withTempHome(async () => {
  setLanIpOverride(''); // 自动模式
  const lanToken = tokenForHost('100.64.0.1:3081');
  const publicToken = tokenForHost('pocket.example.com');
  assert.notEqual(lanToken, publicToken);
  assert.equal(tokenForHost('100.127.255.254:3081'), lanToken, '100.127 仍属 100.64/10');
  assert.equal(tokenForHost('100.63.0.1:3081'), publicToken, '100.63 超出范围 → 公网密码');
  assert.equal(tokenForHost('100.128.0.1:3081'), publicToken, '100.128 超出范围 → 公网密码');
}));
