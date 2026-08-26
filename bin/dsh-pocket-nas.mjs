#!/usr/bin/env node
// dsh-pocket-nas — 把 DeepSeek Harness 装进你的口袋
//
// 用法：
//   dsh-pocket-nas                 # 局域网模式：手机同一 WiFi 扫码访问
//   dsh-pocket-nas --public        # 公网模式：cloudflared 隧道，人在外面也能访问
//   dsh-pocket-nas --port 3081     # 自定义代理端口（默认 3081；dsh web 保持 3080）
//
// 前提：dsh web 已在 127.0.0.1:3080 运行。
// 手机看到的界面 = 电脑上的界面，实时同步（WebSocket 流式透传）。

import { networkInterfaces } from 'node:os';
import { createRequire } from 'node:module';
import { createPocketProxy } from '../lib/proxy.mjs';
import { startQuickTunnel } from '../lib/tunnel.mjs';

const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const args = { port: 3081, host: '0.0.0.0', public: false, upstream: { host: '127.0.0.1', port: 3080 } };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--public') args.public = true;
    else if (a === '--port') args.port = Number(argv[++i]) || 3081;
    else if (a === '--host') args.host = argv[++i] ?? '0.0.0.0';
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
  }
  return args;
}

function printHelp() {
  console.log(`dsh-pocket-nas — 手机访问电脑上的 DeepSeek Harness

用法：
  dsh-pocket-nas             局域网模式（手机同一 WiFi）
  dsh-pocket-nas --public    公网模式（cloudflared 隧道，人在外面）
  dsh-pocket-nas --port 3081 自定义代理端口
  dsh-pocket-nas --help      帮助

前提：dsh web 已在 127.0.0.1:3080 运行（npx @deepseek-ai/dsh web）。

安全提醒：dsh web 能执行代码。二维码/URL 就是钥匙，请勿发给别人。
`);
}

function lanIPv4() {
  const addrs = [];
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const i of ifaces ?? []) {
      if (i.family === 'IPv4' && !i.internal) addrs.push(i.address);
    }
  }
  return addrs[0] ?? null;
}

function printQr(url, label) {
  const qrcodeTerminal = require('qrcode-terminal');
  console.log(`\n${label}\n  ${url}`);
  qrcodeTerminal.generate(url, { small: true }, (qr) => console.log(qr));
  console.log('');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log('🚀 dsh-pocket-nas 启动中…');
  const { port, close } = await createPocketProxy(args);

  const lan = lanIPv4();
  if (lan) {
    printQr(`http://${lan}:${port}`, '📶 局域网访问（手机连同一 WiFi）：');
  } else {
    console.log('⚠️  未检测到局域网 IP，跳过局域网二维码');
  }

  // Ctrl+C / kill：停隧道 → 关代理 → 真正退出（修复：之前只停隧道不退出进程）
  const controller = new AbortController();
  let tunnel = null;
  const shutdown = async () => {
    console.log('\n👋 dsh-pocket-nas 已退出 | bye');
    controller.abort();
    tunnel?.kill();
    await close().catch(() => {});
    process.exit(130);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  if (args.public) {
    console.log('🌐 正在建立公网隧道（cloudflared）…');
    try {
      tunnel = await startQuickTunnel({ port, signal: controller.signal });
      printQr(tunnel.url, '🌐 公网访问（人在外面也能用）：');
      console.log('   隧道会持续运行；Ctrl+C 退出（下次启动会换新 URL）');
    } catch (err) {
      console.error(`❌ 公网隧道失败：${err.message}（局域网二维码仍可用）`);
    }
  } else {
    console.log(`   （加 --public 开启公网隧道）`);
  }

  console.log(`✅ dsh-pocket-nas 已就绪：手机扫码上面的二维码，看到的界面与电脑完全一致、实时同步。\n   按 Ctrl+C 停止。`);
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(`❌ dsh-pocket-nas: ${err?.message ?? err}`);
  process.exit(1);
});
