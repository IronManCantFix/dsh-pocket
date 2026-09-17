// 认证加固回归测试：
//   1) clientIp：cf-connecting-ip 只在 loopback 来源（cloudflared 回连）可信，
//      非 loopback 来源一律用 socket 地址——否则能直连代理端口的人换个头就换
//      一个身份，登录限速与握手计数形同虚设。
//   2) POST /pocket-login：与主 PIN 比较走常量时间，且接受替代令牌
//      （getAltTokens 钩子），与 cookie / ?token= 两条通道行为一致。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { createHash } from 'node:crypto';

import { clientIp, createPocketProxy } from '../lib/proxy.mjs';

test('clientIp：仅本机（cloudflared 回连）来源才认 cf-connecting-ip', () => {
  assert.equal(
    clientIp({ headers: { 'cf-connecting-ip': '1.2.3.4' }, socket: { remoteAddress: '127.0.0.1' } }),
    '1.2.3.4',
    'loopback 来源（隧道回连）认 Cloudflare 写入的真实客户端 IP',
  );
  assert.equal(
    clientIp({ headers: { 'cf-connecting-ip': '1.2.3.4' }, socket: { remoteAddress: '::ffff:127.0.0.1' } }),
    '1.2.3.4',
    'IPv4-mapped IPv6 的 loopback 同样算本机',
  );
  // 能直连代理端口的人可以随手伪造这个头：非 loopback 来源必须忽略它
  assert.equal(
    clientIp({ headers: { 'cf-connecting-ip': '1.2.3.4' }, socket: { remoteAddress: '203.0.113.9' } }),
    '203.0.113.9',
    '非本机来源忽略伪造的 cf-connecting-ip（限速身份不可被头篡改）',
  );
  assert.equal(
    clientIp({ headers: { 'cf-connecting-ip': '1.2.3.4' }, socket: { remoteAddress: '192.168.1.7' } }),
    '192.168.1.7',
    '局域网来源同样忽略',
  );
  assert.equal(
    clientIp({ headers: {}, socket: { remoteAddress: '192.168.1.7' } }),
    '192.168.1.7',
    '无该头时用 socket 地址',
  );
  assert.equal(
    clientIp({ headers: { 'cf-connecting-ip': '1.2.3.4' } }),
    'unknown',
    '拿不到 socket 地址时不凭请求头臆造身份',
  );
});

/** 起一个假上游 + 带主/替代令牌的代理，返回登录与带 cookie 访问两个助手。 */
async function withAuthProxy(fn) {
  const up = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><head></head><body>dsh</body></html>');
  });
  await new Promise((r) => up.listen(0, '127.0.0.1', r));
  const MAIN = '12345678';
  const ALT = '87654321';
  const SESSION_KEY = 'session-key-for-test';
  const proxy = await createPocketProxy({
    port: 0,
    host: '127.0.0.1',
    upstream: { host: '127.0.0.1', port: up.address().port },
    auth: {
      sessionKey: SESSION_KEY,
      getToken: () => MAIN,
      getAltTokens: (host) => (String(host).includes('trycloudflare') ? [ALT] : []),
      isProtected: () => true,
    },
  });
  const login = (pin) => new Promise((resolve, reject) => {
    const req = httpRequest({
      host: '127.0.0.1',
      port: proxy.port,
      method: 'POST',
      path: '/pocket-login',
      headers: { Host: 'abc.trycloudflare.com', 'Content-Type': 'application/x-www-form-urlencoded' },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.write(`token=${pin}`);
    req.end();
  });
  const getWithCookie = (cookie) => new Promise((resolve, reject) => {
    const req = httpRequest({
      host: '127.0.0.1',
      port: proxy.port,
      path: '/',
      headers: { Host: 'abc.trycloudflare.com', accept: 'text/html', cookie },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
  try {
    await fn({ login, getWithCookie, MAIN, ALT, SESSION_KEY });
  } finally {
    await proxy.close();
    await new Promise((r) => up.close(r));
  }
}

/** 登录 cookie 的期望值（与 proxy 的 cookieFor 同算法）。 */
function expectedCookie(token, sessionKey) {
  return createHash('sha256').update(`${token}:${sessionKey}`).digest('hex');
}

test('登录（POST /pocket-login）：主密码与替代令牌都能登录，且种下对应的会话 cookie', async () => {
  await withAuthProxy(async ({ login, getWithCookie, MAIN, ALT, SESSION_KEY }) => {
    // 1) 替代令牌（临时 PIN 钩子）登录：此前只与主 PIN 明文 `===` 比较，替代令牌被挡
    const rAlt = await login(ALT);
    assert.equal(rAlt.status, 302, '替代令牌登录成功（302 回首页）');
    const setCookie = String(rAlt.headers['set-cookie'] ?? '');
    assert.ok(setCookie.includes(expectedCookie(ALT, SESSION_KEY)), 'cookie 绑定替代令牌而非主 PIN');
    const withAlt = await getWithCookie(`dsh_pocket_token=${expectedCookie(ALT, SESSION_KEY)}`);
    assert.equal(withAlt.status, 200, '替代令牌的 cookie 可正常访问');

    // 2) 主密码照常可用
    const rMain = await login(MAIN);
    assert.equal(rMain.status, 302, '主密码登录成功');
    assert.ok(
      String(rMain.headers['set-cookie'] ?? '').includes(expectedCookie(MAIN, SESSION_KEY)),
      'cookie 绑定主 PIN',
    );

    // 3) 错误密码仍然拒绝（常量时间比较没把正确/错误弄反）
    const rBad = await login('00000000');
    assert.equal(rBad.status, 200, '错误密码回到登录页');
    assert.ok(rBad.body.includes('密码错误'), '给出错误提示');
  });
});
