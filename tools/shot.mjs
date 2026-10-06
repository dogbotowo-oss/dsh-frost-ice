/**
 * 给 dsh-frost-ice 出「真实界面」效果图。
 *
 * 做法：按 @deepseek-ai/dsh-client-connection 的规则给自己签一个浏览器会话 cookie，
 * 让无头 Edge 真正打开本地 DSH 页面，再注入皮肤、截图。
 *
 * 只读：不动 profile，不装插件，不写 ~/.dsh。cookie 只活在这台无头进程的内存 profile 里。
 *
 * 跑法：node tools/shot.mjs
 * 产出：real-default.png / real-skinned.png / real-settings.png
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openApp, evaluate, loadSkin, injectionExpression, sleep } from './cdp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const out = (name) => join(root, name)

const CLICK_SETTINGS = `(() => {
  const all = [...document.querySelectorAll('button, a, [role="button"]')];
  const hit = all.find((el) => (el.textContent || '').trim() === '设置')
    || all.find((el) => (el.getAttribute('aria-label') || '').includes('设置'));
  if (hit === undefined) return 'not-found';
  hit.click();
  return 'clicked';
})()`

/** 统计一下皮肤实际命中了多少元素，顺便把浮层标记数带出来。 */
const REPORT = `(() => {
  const blur = document.querySelectorAll('[data-dsh-frost-ice-blur]').length;
  const dialog = document.querySelectorAll('[role="dialog"]').length;
  const style = document.querySelector('style[data-plugin-css="dsh-frost-ice/skin.css"]') !== null;
  const flag = document.body.hasAttribute('data-dsh-frost-ice');
  const base = getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-base').trim();
  const sidebar = getComputedStyle(document.body).getPropertyValue('--dsw-specific-sidebar-fill').trim();
  const label = getComputedStyle(document.body).getPropertyValue('--dsw-alias-label-primary').trim();
  return JSON.stringify({ style, flag, blurMarked: blur, dialogs: dialog, bgBase: base, sidebar, labelPrimary: label });
})()`

async function shoot(cdp, name) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(out(name), Buffer.from(shot.data, 'base64'))
  console.log('已写出', name)
}

const app = await openApp(9340)
try {
  await shoot(app.cdp, 'real-default.png')

  const skin = await loadSkin(root)
  console.log('注入:', await evaluate(app.cdp, injectionExpression(skin)))
  await sleep(2500)
  await shoot(app.cdp, 'real-skinned.png')
  console.log('报告:', await evaluate(app.cdp, REPORT))

  console.log('点设置:', await evaluate(app.cdp, CLICK_SETTINGS))
  await sleep(2500)
  await shoot(app.cdp, 'real-settings.png')
  console.log('报告(浮层打开):', await evaluate(app.cdp, REPORT))

  app.close()
} catch (error) {
  console.error('失败:', error.message)
  process.exitCode = 1
} finally {
  app.kill()
}
