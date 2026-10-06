/**
 * 探针：打开真实 DSH，点开「设置」，把弹出的面板结构与几何打出来。
 * 目的：确认浮层模糊该打在哪些元素上（`role="dialog"`？带遮罩的 fixed 容器？），
 * 而不是靠猜类名。
 *
 * 跑法：node tools/probe-overlay.mjs
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openApp, evaluate, sleep } from './cdp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
void root

/** 页面上按文本找按钮并点击。 */
const CLICK_SETTINGS = `(() => {
  const all = [...document.querySelectorAll('button, a, [role="button"]')];
  const hit = all.find((el) => (el.textContent || '').trim() === '设置')
    || all.find((el) => (el.getAttribute('aria-label') || '').includes('设置'));
  if (hit === undefined) return 'not-found';
  hit.click();
  return 'clicked';
})()`

/** 弹出后：找出可能是浮层的元素。 */
const PROBE = `(() => {
  const rows = [];
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const area = Math.round(r.width * r.height);
    if (area < 20000) continue;
    const pos = cs.position;
    const z = Number.parseInt(cs.zIndex, 10);
    const isLayer = pos === 'fixed' || pos === 'absolute' || Number.isFinite(z);
    if (!isLayer) continue;
    rows.push({
      tag: el.tagName.toLowerCase(),
      cls: typeof el.className === 'string' ? el.className.trim().slice(0, 80) : '',
      role: el.getAttribute('role') || '',
      ariaModal: el.getAttribute('aria-modal') || '',
      pos, z: Number.isFinite(z) ? z : null,
      area,
      bg: cs.backgroundColor,
      blur: cs.backdropFilter,
      shadow: cs.boxShadow.slice(0, 40),
    });
  }
  rows.sort((a, b) => (b.z ?? 0) - (a.z ?? 0) || b.area - a.area);
  return JSON.stringify(rows.slice(0, 40), null, 1);
})()`

const app = await openApp(9338)
try {
  console.log('点设置:', await evaluate(app.cdp, CLICK_SETTINGS))
  await sleep(2500)
  const json = await evaluate(app.cdp, PROBE)
  const rows = JSON.parse(json)
  console.log('--- 候选浮层（按 z-index 降序）---')
  for (const row of rows) {
    console.log(`z=${String(row.z).padStart(4)} ${row.pos.padEnd(8)} ${String(row.area).padStart(8)}px² role=${row.role || '-'} aria-modal=${row.ariaModal || '-'} blur=${row.blur}`)
    console.log(`        ${row.tag}.${row.cls}`)
    console.log(`        bg=${row.bg} shadow=${row.shadow}`)
  }
  const shot = await app.cdp.send('Page.captureScreenshot', { format: 'png' })
  const { writeFileSync } = await import('node:fs')
  writeFileSync(join(root, 'real-settings-open.png'), Buffer.from(shot.data, 'base64'))
  console.log('已写出 real-settings-open.png')
} finally {
  app.kill()
}
process.exit(0)
