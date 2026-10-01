// 左侧残留窄条诊断（在手机浏览器打开页面后，用开发者工具/Safari 远程调试执行）
//
// 用法：
//   1. 手机打开 DSH Pocket 页面，收起侧边栏（露出那条窄条）
//   2. 用 Safari 远程调试（Mac:Safari → 开发 → <你的手机> → 页面）
//      或 Chrome 远程调试连上
//   3. 把本文件内容整段粘进 Console 回车
//   4. 把输出贴回来
//
// 它会把「视口左侧 120px 内所有可见元素」逐个列出来并给出精确定位信息，
// 从而确定那条窄条到底是谁画的。

(function diagnoseLeftStrip() {
  const BAND = 120; // 检查左侧 120px 宽的范围
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const describe = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      // 类名/属性是最有用的线索
      cls: (el.className && typeof el.className === 'string') ? el.className : '',
      attrs: [...el.attributes]
        .filter((a) => a.name.startsWith('data-') || a.name === 'role' || a.name === 'id')
        .map((a) => `${a.name}="${a.value}"`)
        .join(' '),
      rect: `x=${Math.round(r.x)} y=${Math.round(r.y)} w=${Math.round(r.width)} h=${Math.round(r.height)}`,
      position: cs.position,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      zIndex: cs.zIndex,
      transform: cs.transform,
      background: cs.backgroundColor,
      overflow: cs.overflow,
      parentChain: (() => {
        const chain = [];
        let p = el.parentElement;
        let depth = 0;
        while (p && depth < 6) {
          const pr = p.getBoundingClientRect();
          chain.push(
            `${p.tagName.toLowerCase()}${p.id ? '#' + p.id : ''}` +
            `[${Math.round(pr.width)}x${Math.round(pr.height)}]`
          );
          p = p.parentElement;
          depth++;
        }
        return chain.join(' < ');
      })(),
    };
  };

  const hits = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // 只看「落在左侧带内、且有一定高度」的元素
    if (r.left > BAND) continue;
    if (r.height < 40) continue;
    // 排除纯容器（没有背景、没有文字、没有图标）
    const hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
    const hasText = (el.textContent || '').trim().length > 0;
    const hasSvg = el.querySelector('svg') !== null;
    const hasBorder = cs.borderRightWidth !== '0px' || cs.borderLeftWidth !== '0px';
    if (!hasBg && !hasText && !hasSvg && !hasBorder) continue;
    hits.push({ el, info: describe(el), area: r.width * r.height });
  }

  // 按面积从大到小（大的更可能是"那块区域"），并只保留最外层的几个
  hits.sort((a, b) => b.area - a.area);

  console.log('=== 视口 ===', `${vw}x${vh}`);
  console.log('=== 左侧窄条候选元素 ===', hits.length, '个');
  console.log('');
  hits.slice(0, 12).forEach((h, i) => {
    console.log(`--- #${i + 1} ---`);
    console.log('  元素   :', h.info.tag, h.info.cls || '(无类名)');
    if (h.info.attrs) console.log('  属性   :', h.info.attrs);
    console.log('  位置   :', h.info.rect);
    console.log('  定位   :', h.info.position, '| display:', h.info.display, '| visibility:', h.info.visibility);
    console.log('  z-index:', h.info.zIndex, '| transform:', h.info.transform);
    console.log('  背景   :', h.info.background, '| overflow:', h.info.overflow);
    console.log('  父链   :', h.info.parentChain);
    console.log('');
  });

  // 额外：把 AppFrame 的直接子元素全列出来（抽屉问题是这一层）
  const frame = document.querySelector('[data-mobile-nav="frame"]');
  if (frame) {
    console.log('=== AppFrame 子元素（抽屉所在层）===');
    console.log('frame 属性:', [...frame.attributes].map((a) => `${a.name}="${a.value}"`).join(' '));
    [...frame.children].forEach((c, i) => {
      const cs = getComputedStyle(c);
      const r = c.getBoundingClientRect();
      console.log(
        `  子${i + 1}: ${c.tagName.toLowerCase()} [${Math.round(r.width)}x${Math.round(r.height)}] ` +
        `x=${Math.round(r.x)} pos=${cs.position} vis=${cs.visibility} tf=${cs.transform} ` +
        `cls=${(typeof c.className === 'string' ? c.className : '').slice(0, 60)}`
      );
    });
  } else {
    console.log('⚠️ 没找到 [data-mobile-nav="frame"] —— pocket 的移动端标记没生效，插件可能没加载');
  }

  // 再额外：body 直接子元素里 fixed/absolute 的
  console.log('');
  console.log('=== body 下 fixed/absolute 元素（第三方插件常见锚点）===');
  [...document.body.children].forEach((c, i) => {
    const cs = getComputedStyle(c);
    if (cs.position !== 'fixed' && cs.position !== 'absolute') return;
    const r = c.getBoundingClientRect();
    console.log(
      `  ${i + 1}: ${c.tagName.toLowerCase()}${c.id ? '#' + c.id : ''} [${Math.round(r.width)}x${Math.round(r.height)}] ` +
      `x=${Math.round(r.x)} z=${cs.zIndex} vis=${cs.visibility} cls=${(typeof c.className === 'string' ? c.className : '').slice(0, 60)}`
    );
  });

  return '诊断完成：请把以上输出整段复制回来';
})();
