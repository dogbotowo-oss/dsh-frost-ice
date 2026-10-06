/**
 * CDP 小工具：给「真实页面截图 / DOM 探针」这类脚本共用。
 * 只做两件事：起无头 Edge 并连上它、按 DSH 自己的规则签一个浏览器会话 cookie。
 * 零第三方依赖。
 */
import { readFileSync, mkdtempSync } from 'node:fs'
import { createHash, createHmac } from 'node:crypto'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
export const APP_URL = 'http://127.0.0.1:3082/'
export const AUTHORITY = '127.0.0.1:3082'
const DAY = 86400000

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const b64u = (buf) => Buffer.from(buf).toString('base64')
  .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')

/**
 * 按 @deepseek-ai/dsh-client-connection 的算法签一个浏览器会话 cookie：
 *   name  = dsh-auth-<base64url(sha256(authority))>
 *   value = v1.<base64url(JSON payload)>.<base64url(HMAC-SHA256(payload))>
 * 只读 $DSH_HOME/.credentials.yaml，不写任何东西。
 * @returns {{name: string, value: string, expires: number}}
 */
export function sessionCookie(home = process.env.DSH_HOME ?? '') {
  const creds = readFileSync(join(home, '.credentials.yaml'), 'utf8')
  const raw = /browser-session:[\s\S]*?secret:\s*(\S+)/.exec(creds)?.[1]
  if (raw === undefined) throw new Error('没有在 .credentials.yaml 里找到 browser-session secret')
  const secret = Buffer.from(raw.replaceAll('-', '+').replaceAll('_', '/'), 'base64')
  const issuedAt = Date.now()
  const expiresAt = issuedAt + 30 * DAY
  const body = b64u(JSON.stringify({ version: 1, authority: AUTHORITY, issuedAt, expiresAt }))
  return {
    name: 'dsh-auth-' + b64u(createHash('sha256').update(AUTHORITY).digest()),
    value: `v1.${body}.${b64u(createHmac('sha256', secret).update(body).digest())}`,
    expires: Math.floor(expiresAt / 1000),
  }
}

/** 起无头 Edge 并等 CDP 端点就绪。 */
export async function launch(port, windowSize = '1500,1000') {
  const profile = mkdtempSync(join(tmpdir(), 'dsh-cdp-'))
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--window-size=${windowSize}`,
    'about:blank',
  ], { stdio: 'ignore' })

  let ready = false
  for (let i = 0; i < 80 && !ready; i++) {
    try { ready = (await fetch(`http://127.0.0.1:${port}/json/version`)).ok } catch { /* 还没起来 */ }
    if (!ready) await sleep(250)
  }
  if (!ready) {
    edge.kill()
    throw new Error('CDP 端点没起来（无头 Edge 启动失败）')
  }
  return { edge, kill: () => edge.kill() }
}

/** 极简 CDP 客户端，够本项目用。 */
export function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const pending = new Map()
    let id = 0
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) {
        const messageId = ++id
        return new Promise((res, rej) => {
          pending.set(messageId, { res, rej })
          ws.send(JSON.stringify({ id: messageId, method, params }))
        })
      },
      close: () => ws.close(),
    }))
    ws.addEventListener('error', reject)
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id === undefined) return
      const slot = pending.get(msg.id)
      if (slot === undefined) return
      pending.delete(msg.id)
      if (msg.error) slot.rej(new Error(method + ': ' + JSON.stringify(msg.error)))
      else slot.res(msg.result)
    })
  })
}

/**
 * 打开真实 DSH 页面并把浏览器会话 cookie 装上。
 * @param {number} port - 调试端口。
 * @param {{waitMs?: number}} [options] - 导航后等多久（默认 9s，等外壳与插件挂完）。
 * @returns {{cdp: object, kill: () => void, close: () => void}}
 */
export async function openApp(port, options = {}) {
  const browser = await launch(port)
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page === undefined) throw new Error('没有可用的 page target')
    const cdp = await connect(page.webSocketDebuggerUrl)

    const cookie = sessionCookie()
    await cdp.send('Network.enable')
    await cdp.send('Network.setCookie', {
      name: cookie.name, value: cookie.value, domain: '127.0.0.1', path: '/',
      httpOnly: true, sameSite: 'Strict', expires: cookie.expires,
    })
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Page.navigate', { url: APP_URL })
    await sleep(options.waitMs ?? 9000)
    return { cdp, kill: browser.kill, close: () => cdp.close() }
  } catch (error) {
    browser.kill()
    throw error
  }
}

/** 在页面里求值并返回 JSON 化结果。 */
export async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails !== undefined) {
    throw new Error('页面内求值失败: ' + JSON.stringify(result.exceptionDetails))
  }
  return result.result?.value
}

/** 从 client.js 里取出 TOKENS 与 CSS（唯一真源，避免预览和实现漂移）。 */
export async function loadSkin(root) {
  const code = readFileSync(join(root, 'client', 'client.js'), 'utf8')
  let captured = null
  const vm = await import('node:vm')
  vm.runInNewContext(code, {
    window: { __ModuleLoader__: { load: (entry) => { captured = entry } } },
    document: { querySelector: () => null, createElement: () => ({ dataset: {} }), head: { appendChild() {} }, body: null },
    console,
  }, { filename: 'client/client.js' })
  const plugin = captured.factory(() => { throw new Error('不该 require') })
  return { tokens: plugin.TOKENS, css: plugin.CSS }
}

/** 在页面里复刻 apply() 的两件事：写 token 覆盖层 + 注入样式表 + 打 body 标记。 */
export function injectionExpression({ tokens, css }) {
  return `(() => {
    const tokens = ${JSON.stringify(tokens)};
    const css = ${JSON.stringify(css)};
    const body = document.body;
    for (const [name, modes] of Object.entries(tokens)) body.style.setProperty(name, modes.light);
    if (document.querySelector('style[data-plugin-css="dsh-frost-ice/skin.css"]') === null) {
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-frost-ice';
      tag.dataset.pluginCss = 'dsh-frost-ice/skin.css';
      tag.textContent = css;
      document.head.appendChild(tag);
    }
    body.setAttribute('data-dsh-frost-ice', '');
    return 'injected';
  })()`
}
