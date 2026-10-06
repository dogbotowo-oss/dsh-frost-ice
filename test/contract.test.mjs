/**
 * dsh-frost-ice 的离线契约测试：用 node:vm 造一个最小浏览器环境，验证
 *   1. bundle 通过 window.__ModuleLoader__.load 注册自己，id 正确；
 *   2. factory 返回 CommonJS 形状，导出 name / inject / apply；
 *   3. apply() 会向主题服务注册 token 覆盖层，且**不碰任何 label-\* 文字色 token**；
 *   4. 会注入样式表、给 body 打标记；
 *   5. 卸载后样式表、body 标记、token 层全部回收。
 *
 * 跑法：node test/contract.test.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const code = readFileSync(join(here, '..', 'client', 'client.js'), 'utf8')

/** 造一个够用的 DOM + window + 主题服务，然后物化 bundle。 */
function boot() {
  const head = []
  const listeners = new Map()
  const overrides = new Map()
  const effects = []

  class Element {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase()
      this.dataset = {}
      this.attributes = new Map()
      this.textContent = ''
      this.children = []
    }
    setAttribute(k, v) { this.attributes.set(k, v) }
    getAttribute(k) { return this.attributes.get(k) ?? null }
    hasAttribute(k) { return this.attributes.has(k) }
    removeAttribute(k) { this.attributes.delete(k) }
    appendChild(child) { this.children.push(child); return child }
    querySelectorAll(selector) {
      const found = []
      const visit = (el) => {
        for (const child of el.children) {
          if (selector === '*' || (selector.startsWith('[') && child.hasAttribute(selector.slice(1, -1)))) found.push(child)
          visit(child)
        }
      }
      visit(this)
      return found
    }
    remove() {
      for (const list of [head, body.children]) {
        const i = list.indexOf(this)
        if (i >= 0) list.splice(i, 1)
      }
    }
  }

  const body = new Element('body')
  const documentElement = new Element('html')
  documentElement.children.push(body)

  const document = {
    head: { appendChild: (el) => head.push(el) },
    body,
    documentElement,
    createElement: (tag) => new Element(tag),
    querySelector(selector) {
      const m = /^style\[data-plugin-css="(.+)"\]$/.exec(selector)
      if (m === null) return null
      return head.find((el) => el.dataset.pluginCss === m[1]) ?? null
    },
  }

  const ctx = {
    theme: {
      overrideTokens(source, tokens) {
        overrides.set(source, tokens)
        return () => overrides.delete(source)
      },
    },
    on(event, cb) {
      listeners.set(event, cb)
      return () => listeners.delete(event)
    },
    effect(cb, label) {
      const dispose = cb()
      effects.push({ label, dispose })
      return () => { const i = effects.indexOf(dispose); if (i >= 0) effects.splice(i, 1) }
    },
  }

  const registration = {}
  const window = {
    __ModuleLoader__: { load: (entry) => Object.assign(registration, entry) },
  }

  const sandbox = { window, document, console, MutationObserver: undefined }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox, { filename: 'client/client.js' })

  assert.equal(registration.id, 'dsh-frost-ice', 'load() 的 id 必须是包名')
  assert.equal(typeof registration.factory, 'function', 'load() 必须带 factory')
  const exported = registration.factory((id) => { throw new Error('不该 require: ' + id) })

  return { exported, ctx, head, overrides, effects, listeners, body, document, window }
}

// --- 1. 导出契约 ---------------------------------------------------------
{
  const env = boot()
  assert.equal(env.exported.name, 'dsh-frost-ice')
  assert.deepEqual([...env.exported.inject], ['theme'])
  assert.equal(typeof env.exported.apply, 'function')
}

// --- 2. apply() 行为 -----------------------------------------------------
{
  const env = boot()
  env.exported.apply(env.ctx)

  assert.ok(env.overrides.has('dsh-frost-ice'), '必须注册 token 覆盖层')
  const tokens = env.overrides.get('dsh-frost-ice')

  // 每个 token 必须两种模式都给值（快照折叠时按活动配色取值）。
  for (const [name, value] of Object.entries(tokens)) {
    assert.ok(typeof value.light === 'string' && value.light.length > 0, name + ' 缺 light')
    assert.ok(typeof value.dark === 'string' && value.dark.length > 0, name + ' 缺 dark')
    assert.notEqual(value.light, undefined)
  }

  // 核心诉求：不覆盖任何文字色 token，正文保持 DSH 原本的近黑。
  const labelTokens = Object.keys(tokens).filter((n) => n.includes('label-'))
  assert.deepEqual(labelTokens, [], '不允许覆盖 label-* 文字色 token：' + labelTokens.join(', '))
  assert.ok(!('--dsw-alias-link' in tokens), '不允许覆盖链接色 token')

  // 关键背景层级必须被覆盖，否则玻璃没有半透明底。
  for (const required of [
    '--dsw-alias-bg-base',
    '--dsw-alias-bg-layer-1',
    '--dsw-alias-bg-layer-2',
    '--dsw-alias-bg-overlay',
  ]) {
    assert.ok(required in tokens, '缺少关键 token ' + required)
  }

  // 实测结论：侧栏走的是 specific 家族，漏掉它磨砂只做一半。
  for (const required of [
    '--dsw-specific-sidebar-fill',
    '--dsw-specific-sidebar-nav-item-hover',
    '--dsw-specific-input-major',
    '--dsw-specific-menu',
  ]) {
    assert.ok(required in tokens, '缺少 specific 家族 token ' + required)
  }

  assert.equal(env.head.length, 1, '必须注入一张样式表')
  assert.equal(env.head[0].dataset.plugin, 'dsh-frost-ice')
  assert.match(env.head[0].textContent, /linear-gradient\(160deg, #F2F8FF/)
  // 浮层模糊必须靠运行时标记，绝不能用 [class*=] 子串猜类名（会糊死整页）。
  assert.match(env.head[0].textContent, /\[data-dsh-frost-ice-blur\]/)
  assert.ok(!/\[class\*=/i.test(env.head[0].textContent), '不允许用 [class*=] 子串匹配类名')
  assert.ok(env.body.hasAttribute('data-dsh-frost-ice'), '必须给 body 打标记')
  assert.equal(typeof env.window.__dshFrostIce?.inspect, 'function', '必须挂上排查助手')
}

// --- 3. 卸载回收 ---------------------------------------------------------
{
  const env = boot()
  env.exported.apply(env.ctx)
  assert.equal(env.head.length, 1)
  assert.ok(env.overrides.has('dsh-frost-ice'))

  for (const entry of env.effects) entry.dispose()

  assert.equal(env.head.length, 0, '卸载后样式表必须移除')
  assert.ok(!env.body.hasAttribute('data-dsh-frost-ice'), '卸载后 body 标记必须移除')
  assert.ok(!env.overrides.has('dsh-frost-ice'), '卸载后 token 层必须移除')
}

// --- 4. 缺主题服务时安静跳过 ---------------------------------------------
{
  const env = boot()
  const warnings = []
  const originalWarn = console.warn
  console.warn = (msg) => warnings.push(String(msg))
  env.exported.apply({ theme: undefined, effect() {}, on() { return () => {} } })
  console.warn = originalWarn
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /dsh-frost-ice/)
}

console.log('✓ dsh-frost-ice 契约测试全部通过（4 组）')
