#!/usr/bin/env node
// 一键发布：更新版本号 → 构建前端 → 提交 → 打 tag → 推送
//
// 用法：
//   node bin/release.mjs 1.16.2
//
// 效果：
//   1. 把 package.json 的 version 改成 1.16.2
//   2. 重新构建前端（client/client.js 保持最新）
//   3. 提交 package.json + client.js
//   4. 打 tag v1.16.2
//   5. 推送 commit + tag 到 origin（触发 GitHub Actions 自动发布）
//
// 前提：工作区干净（无未提交改动），否则中止。

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const pkgPath = resolve(root, 'package.json');

// ---------- 参数校验 ----------
const version = process.argv[2];
if (!version) {
  console.error('❌ 缺少版本号参数。用法：node bin/release.mjs <version>');
  console.error('   例：node bin/release.mjs 1.16.2');
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`❌ 版本号格式不对："${version}"。应为数字格式，如 1.16.2 或 1.16.2-beta.1`);
  process.exit(1);
}

// ---------- 检查工作区是否干净 ----------
const status = execSync('git status --porcelain', { cwd: root }).toString().trim();
if (status) {
  console.error('❌ 工作区有未提交改动，请先提交或暂存：');
  console.error(status.split('\n').map((l) => '   ' + l).join('\n'));
  process.exit(1);
}

// ---------- 更新 package.json ----------
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
if (oldVersion === version) {
  console.error(`⚠️  版本号已经是 ${version}，无需更新。`);
  console.error('   如需重新发布，请先提交其他改动，再运行本脚本。');
  process.exit(1);
}
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`✅ package.json: ${oldVersion} → ${version}`);

// ---------- 构建前端 ----------
console.log('🔨 构建前端…');
execSync('node client/build.mjs', { cwd: root, stdio: 'inherit' });
console.log('✅ 前端构建完成');

// ---------- 提交 ----------
console.log('📦 提交版本号 + 构建产物…');
execSync('git add package.json package-lock.json client/client.js', { cwd: root });
execSync(`git commit -m "chore: release v${version}"`, { cwd: root, stdio: 'inherit' });
console.log('✅ 已提交');

// ---------- 打 tag ----------
console.log(`🏷️  打 tag v${version}…`);
execSync(`git tag v${version}`, { cwd: root, stdio: 'inherit' });
console.log('✅ 已打 tag');

// ---------- 推送 ----------
console.log('🚀 推送 commit + tag 到 origin…');
execSync('git push origin HEAD', { cwd: root, stdio: 'inherit' });
execSync(`git push origin v${version}`, { cwd: root, stdio: 'inherit' });
console.log('✅ 已推送');

console.log('');
console.log(`🎉 发布流程已触发！版本 v${version} 正在由 GitHub Actions 构建。`);
console.log('   进度查看：https://github.com/IronManCantFix/dsh-pocket/actions');
console.log('   Release 页面：https://github.com/IronManCantFix/dsh-pocket/releases');
