/**
 * dsh-frost-ice — DSH Web GUI「极淡冰蓝磨砂玻璃」皮肤。
 *
 * 这个文件就是插件的浏览器半（`dsh.client` 指向的 bundle）。两种用法：
 *
 *  1. 在 DSH 里：index 注入的 `window.__ModuleLoader__` 取走这里注册的 factory，
 *     等插件第一次被物化时执行，导出 `name` / `inject` / `apply`。
 *  2. 直接双击 `preview.html`：那个页面自带一个最小 __ModuleLoader__ 桩，
 *     离线就能看配色，不需要装进 DSH。
 *
 * 实现方式（为什么不是 `ctx.theme.register`）：
 *   内置主题选择器（设置 → 通用 → 外观）只有 light / dark / system 三个格子，
 *   注册进去的第三方主题 id 没有任何 UI 入口能选中。所以改用主题服务自带的
 *   `overrideTokens(source, tokens)`：把一层 token 覆盖叠在当前主题之上，
 *   插件卸载时自动还原，装上即生效。
 */
window.__ModuleLoader__.load({
  id: 'dsh-frost-ice',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports

    /** 插件名，同时充当 token 覆盖层的 source 标识。 */
    const name = 'dsh-frost-ice'
    /** 只依赖主题服务；其余全是原生 DOM，不需要别的服务。 */
    const inject = ['theme']

    const STYLE_ID = 'dsh-frost-ice/skin.css'
    const BODY_FLAG = 'data-dsh-frost-ice'
    const BLUR_FLAG = 'data-dsh-frost-ice-blur'
    const ANCHOR = '--dsw-alias-bg-base'

    /**
     * alias + specific 两个 token 家族的覆盖。**一律不动任何文字色 token**
     * （`--dsw-alias-label-*`、`--dsw-alias-link`、`--dsw-static-*` 调色板），
     * 所以正文、标题、代码、次要文字全部沿用 DSH 原本的近黑
     * `--dsw-static-neutral-bluish-1000`（#0f1115），可读性与原版一致；
     * 被改的只有背景、描边、交互态和滚动条。
     *
     * 必须同时覆盖两个家族 —— 这是实测出来的：`frame` 用 `--dsw-alias-bg-base`，
     * 但侧栏用的是 `--dsw-specific-sidebar-fill`，只覆盖 alias 的话侧栏保持原本的
     * 实心 #f9fafb，磨砂只能做一半。
     *
     * 两种模式给同一套值：这个皮肤的设计前提就是"永远是浅色磨砂玻璃"（见 README
     * 的已知限制），用户即使把偏好设成 dark/system，看到的也是同一张浅蓝玻璃，
     * 不会出现深底配深字的不可读组合。
     */
    const TOKENS = {
      // —— alias 家族：背景层级。层级越高越白越不透明，高层级面板上的文字始终清楚 ——
      '--dsw-alias-bg-base': { light: 'rgba(247, 252, 255, 0.30)', dark: 'rgba(247, 252, 255, 0.30)' },
      '--dsw-alias-bg-layer-1': { light: 'rgba(255, 255, 255, 0.55)', dark: 'rgba(255, 255, 255, 0.55)' },
      '--dsw-alias-bg-layer-2': { light: 'rgba(255, 255, 255, 0.72)', dark: 'rgba(255, 255, 255, 0.72)' },
      '--dsw-alias-bg-layer-3': { light: 'rgba(255, 255, 255, 0.88)', dark: 'rgba(255, 255, 255, 0.88)' },
      '--dsw-alias-bg-overlay': { light: 'rgba(255, 255, 255, 0.88)', dark: 'rgba(255, 255, 255, 0.88)' },
      '--dsw-alias-bg-module-platform': { light: 'rgba(255, 255, 255, 0.68)', dark: 'rgba(255, 255, 255, 0.68)' },
      '--dsw-alias-bg-multi-select': { light: 'rgba(234, 243, 255, 0.85)', dark: 'rgba(234, 243, 255, 0.85)' },
      '--dsw-alias-bg-skeleton': { light: 'rgba(65, 118, 230, 0.07)', dark: 'rgba(65, 118, 230, 0.07)' },

      // —— alias 家族：浮层 ——
      '--dsw-alias-toast-bg': { light: 'rgba(255, 255, 255, 0.93)', dark: 'rgba(255, 255, 255, 0.93)' },
      '--dsw-alias-tooltip-bg': { light: 'rgba(255, 255, 255, 0.95)', dark: 'rgba(255, 255, 255, 0.95)' },

      // —— alias 家族：浅蓝描边，玻璃的"边" ——
      '--dsw-alias-border-l1': { light: 'rgba(36, 86, 166, 0.08)', dark: 'rgba(36, 86, 166, 0.08)' },
      '--dsw-alias-border-l2': { light: 'rgba(36, 86, 166, 0.13)', dark: 'rgba(36, 86, 166, 0.13)' },
      '--dsw-alias-border-l3': { light: 'rgba(36, 86, 166, 0.17)', dark: 'rgba(36, 86, 166, 0.17)' },
      '--dsw-alias-border-l4': { light: 'rgba(36, 86, 166, 0.22)', dark: 'rgba(36, 86, 166, 0.22)' },

      // —— alias 家族：交互态。色相沿用原值，只把 alpha 抬一点，悬浮/选中在玻璃上才看得见 ——
      '--dsw-alias-interactive-bg-hover': { light: 'rgba(38, 49, 72, 0.08)', dark: 'rgba(38, 49, 72, 0.08)' },
      '--dsw-alias-interactive-bg-active': { light: 'rgba(38, 49, 72, 0.13)', dark: 'rgba(38, 49, 72, 0.13)' },
      '--dsw-alias-interactive-bg-hover-solid': { light: 'rgba(234, 243, 255, 0.88)', dark: 'rgba(234, 243, 255, 0.88)' },

      // —— alias 家族：按钮。主按钮用浅蓝但不透明：玻璃面上的半透明蓝几乎看不见
      //    （实测截图里发送按钮差点消失），所以这里走实色。——
      '--dsw-alias-button-primary-fill': { light: '#9FC6F5', dark: '#9FC6F5' },
      '--dsw-alias-button-primary-hover': { light: '#86B5F2', dark: '#86B5F2' },
      '--dsw-alias-button-primary-dimmed': { light: '#BFD9F8', dark: '#BFD9F8' },
      '--dsw-alias-button-elevated-fill': { light: 'rgba(255, 255, 255, 0.70)', dark: 'rgba(255, 255, 255, 0.70)' },
      '--dsw-alias-button-floating-fill': { light: 'rgba(255, 255, 255, 0.82)', dark: 'rgba(255, 255, 255, 0.82)' },
      '--dsw-alias-button-floating-hover': { light: 'rgba(234, 243, 255, 0.95)', dark: 'rgba(234, 243, 255, 0.95)' },
      '--dsw-alias-button-ghost-active-fill': { light: 'rgba(65, 118, 230, 0.12)', dark: 'rgba(65, 118, 230, 0.12)' },
      '--dsw-alias-button-ghost-active-border': { light: 'rgba(65, 118, 230, 0.32)', dark: 'rgba(65, 118, 230, 0.32)' },
      '--dsw-alias-button-ghost-active-hover': { light: 'rgba(65, 118, 230, 0.18)', dark: 'rgba(65, 118, 230, 0.18)' },
      '--dsw-alias-button-info-fill': { light: 'rgba(65, 118, 230, 0.12)', dark: 'rgba(65, 118, 230, 0.12)' },
      '--dsw-alias-button-info-hover': { light: 'rgba(65, 118, 230, 0.18)', dark: 'rgba(65, 118, 230, 0.18)' },

      // —— alias 家族：滚动条色相跟着变冷，避免灰条压在冰蓝玻璃上 ——
      '--dsw-alias-scrollbar-bg-l1': { light: 'rgba(69, 110, 168, 0.18)', dark: 'rgba(69, 110, 168, 0.18)' },
      '--dsw-alias-scrollbar-hover-l1': { light: 'rgba(69, 110, 168, 0.34)', dark: 'rgba(69, 110, 168, 0.34)' },
      '--dsw-alias-scrollbar-bg-l2': { light: 'rgba(69, 110, 168, 0.16)', dark: 'rgba(69, 110, 168, 0.16)' },
      '--dsw-alias-scrollbar-hover-l2': { light: 'rgba(69, 110, 168, 0.30)', dark: 'rgba(69, 110, 168, 0.30)' },

      // —— specific 家族：零部件语义层。侧栏、输入框、气泡、菜单、下拉、悬浮提示都在这里，
      //    不覆盖它们这些区域会保持原本的实心中性色，玻璃只做了一半。——
      '--dsw-specific-sidebar-fill': { light: 'rgba(237, 245, 255, 0.42)', dark: 'rgba(237, 245, 255, 0.42)' },
      '--dsw-specific-sidebar-nav-item-hover': { light: 'rgba(65, 118, 230, 0.10)', dark: 'rgba(65, 118, 230, 0.10)' },
      '--dsw-specific-sidebar-nav-item-active': { light: 'rgba(65, 118, 230, 0.17)', dark: 'rgba(65, 118, 230, 0.17)' },
      '--dsw-specific-sidebar-nav-item-active-accent': { light: 'rgba(65, 118, 230, 0.24)', dark: 'rgba(65, 118, 230, 0.24)' },
      '--dsw-specific-input-major': { light: 'rgba(255, 255, 255, 0.78)', dark: 'rgba(255, 255, 255, 0.78)' },
      '--dsw-specific-login-input': { light: 'rgba(255, 255, 255, 0.82)', dark: 'rgba(255, 255, 255, 0.82)' },
      '--dsw-specific-menu': { light: 'rgba(255, 255, 255, 0.90)', dark: 'rgba(255, 255, 255, 0.90)' },
      '--dsw-specific-tip': { light: 'rgba(255, 255, 255, 0.92)', dark: 'rgba(255, 255, 255, 0.92)' },
      '--dsw-specific-selector': { light: 'rgba(234, 243, 255, 0.85)', dark: 'rgba(234, 243, 255, 0.85)' },
      '--dsw-specific-bubble': { light: 'rgba(234, 243, 255, 0.80)', dark: 'rgba(234, 243, 255, 0.80)' },
      '--dsw-specific-bubble-highlight': { light: 'rgba(211, 226, 255, 0.85)', dark: 'rgba(211, 226, 255, 0.85)' },
    }

    /**
     * 皮肤样式表。只做三件事：铺冰蓝渐变底、让根容器透明把渐变透上来、
     * 给"确实是浮层"的元素加模糊。
     *
     * 这里刻意**不用** `[class*="menu"]` 这类子串匹配：DSH 的样式是 CSS Module，
     * 真实类名长 `pI_x6G_frame`、`hHd-Xa_root` 这样带哈希，子串匹配会命中祖先
     * 容器，blur 一层层叠加，整个界面被糊死（这是实测踩到的坑）。
     * 浮层靠 apply() 里按几何与层级标记出的 `data-dsh-frost-ice-blur` 来命中。
     */
    const CSS = [
      // 冰蓝渐变底。用 html 承载，各面板半透明，玻璃才有可透的东西。
      // 冷色集中在上缘与两角、中部留白，保证对话区文字始终落在最亮的地方。
      'html:has(body[data-dsh-frost-ice]) {',
      '  background:',
      '    radial-gradient(1200px 800px at 12% -10%, #D8E8FF 0%, rgba(216, 232, 255, 0) 62%),',
      '    radial-gradient(1000px 700px at 98% 6%, #E6F0FF 0%, rgba(230, 240, 255, 0) 58%),',
      '    radial-gradient(900px 600px at 50% 108%, #DEEAFB 0%, rgba(222, 234, 251, 0) 60%),',
      '    linear-gradient(160deg, #F2F8FF 0%, #EAF3FF 45%, #E2EEFE 100%);',
      '  background-attachment: fixed;',
      '}',
      'body[data-dsh-frost-ice] { background-color: transparent; }',

      // 浮层：由 apply() 标记（判据是几何 + 层级 + 半透明背景，不看类名）。
      'body[data-dsh-frost-ice] [' + BLUR_FLAG + '] {',
      '  backdrop-filter: blur(18px) saturate(150%);',
      '  -webkit-backdrop-filter: blur(18px) saturate(150%);',
      '}',

      // overlay 层：DSH 自己就带了这个语义标记（实测 div.pI_x6G_overlayLayer），
      // 它本身透明，只负责让下面的浮层能糊到页面。
      'body[data-dsh-frost-ice] [data-dsh-overlay-layer] > * {',
      '  backdrop-filter: blur(20px) saturate(160%);',
      '  -webkit-backdrop-filter: blur(20px) saturate(160%);',
      '}',

      // 对话框：实测模态面板的背景是**写死的 rgb(255,255,255)**，不走任何 token，
      // 所以光靠 token 覆盖不可能让它变透明 —— 这里显式放开，模糊才有意义。
      'body[data-dsh-frost-ice] [role="dialog"],',
      'body[data-dsh-frost-ice] [data-dsh-overlay-layer] > * {',
      '  background-color: color-mix(in srgb, #FFFFFF 82%, transparent);',
      '}',

      // 不支持 color-mix 的引擎退回一张更实的玻璃。
      '@supports not (background-color: color-mix(in srgb, #fff 50%, transparent)) {',
      '  body[data-dsh-frost-ice] [role="dialog"],',
      '  body[data-dsh-frost-ice] [data-dsh-overlay-layer] > * {',
      '    background-color: rgba(255, 255, 255, 0.94);',
      '  }',
      '}',

      // 不支持 backdrop-filter 的引擎（旧 WebKit）退回更实的玻璃。
      '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {',
      '  body[data-dsh-frost-ice] { --dsw-alias-bg-layer-1: rgba(255, 255, 255, 0.80);',
      '                            --dsw-alias-bg-layer-2: rgba(255, 255, 255, 0.88);',
      '                            --dsw-specific-sidebar-fill: rgba(245, 250, 255, 0.92); }',
      '}',

      // 无障碍：跟随系统「减少透明度」时退回不透明底。
      '@media (prefers-reduced-transparency: reduce) {',
      '  body[data-dsh-frost-ice] { --dsw-alias-bg-base: #FFFFFF;',
      '                            --dsw-alias-bg-layer-1: #FFFFFF;',
      '                            --dsw-alias-bg-layer-2: #FFFFFF;',
      '                            --dsw-alias-bg-layer-3: #FFFFFF;',
      '                            --dsw-alias-bg-overlay: #FFFFFF;',
      '                            --dsw-specific-sidebar-fill: #FFFFFF; }',
      '}',
    ].join('\n')

    /** 注入样式表；重复调用是幂等的。 */
    function injectStyle() {
      if (document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]') !== null) return
      const tag = document.createElement('style')
      tag.dataset.plugin = name
      tag.dataset.pluginCss = STYLE_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /** 移除样式表（卸载/热更时调用）。 */
    function removeStyle() {
      const tag = document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]')
      if (tag !== null) tag.remove()
    }

    /**
     * 找出真正的浮层并打标记。判据取自实测的 DSH DOM：
     * 定位是 fixed/absolute、面积够大、z-index 高于普通流内容、背景是半透明的。
     * 用计算样式而不是类名，所以 CSS Module 的哈希改了也不会失手。
     * @returns 这一轮标记了几个元素。
     */
    function markOverlays() {
      if (document.body === null) return 0
      let marked = 0
      for (const el of document.body.querySelectorAll('*')) {
        const style = getComputedStyle(el)
        if (style.position !== 'fixed' && style.position !== 'absolute') continue
        const zIndex = Number.parseInt(style.zIndex, 10)
        if (!Number.isFinite(zIndex) || zIndex < 10) continue
        const rect = el.getBoundingClientRect()
        if (rect.width * rect.height < 40000) continue
        const match = /^rgba?\(([^)]+)\)$/.exec(style.backgroundColor)
        const alpha = match === null ? 1 : (match[1].split(',').length === 4 ? Number(match[1].split(',')[3]) : 1)
        if (alpha > 0.98) continue // 完全不透明的遮罩不该被模糊（会把底下的内容糊成一团）
        el.setAttribute(BLUR_FLAG, '')
        marked += 1
      }
      return marked
    }

    /** 清掉所有浮层标记。 */
    function clearOverlays() {
      if (document.body === null) return
      for (const el of document.body.querySelectorAll('[' + BLUR_FLAG + ']')) el.removeAttribute(BLUR_FLAG)
    }

    /**
     * 排查助手：控制台里调 `__dshFrostIce.inspect()`，列出带模糊的容器、以及
     * 仍然完全不透明的大面积容器。磨砂在某个区域没出来时，用它拿到真实类名，
     * 再决定要不要在 CSS 里补一条规则。
     * @returns 一份可以直接展开看的报告。
     */
    function inspect() {
      const report = {
        skinActive: document.body !== null && document.body.hasAttribute(BODY_FLAG),
        blurred: [],
        opaque: [],
      }
      if (document.body === null) return report
      for (const el of document.body.querySelectorAll('*')) {
        const style = getComputedStyle(el)
        const selector = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className !== ''
          ? '.' + el.className.trim().split(/\s+/).join('.')
          : '')
        const blur = style.backdropFilter !== '' && style.backdropFilter !== 'none'
          ? style.backdropFilter
          : style.webkitBackdropFilter
        if (blur !== undefined && blur !== '' && blur !== 'none') {
          report.blurred.push({ selector, blur })
          continue
        }
        const rect = el.getBoundingClientRect()
        if (style.backgroundColor.startsWith('rgb(') && rect.width > 240 && rect.height > 160) {
          report.opaque.push({ selector, color: style.backgroundColor })
        }
      }
      report.blurred = report.blurred.slice(0, 40)
      report.opaque = report.opaque.slice(0, 40)
      console.table(report.blurred)
      console.table(report.opaque)
      console.info('[dsh-frost-ice] opaque 里那些大面积不透明容器，就是磨砂没透出来的地方。')
      return report
    }

    function markBody() {
      if (document.body !== null) document.body.setAttribute(BODY_FLAG, '')
    }

    function clearBody() {
      if (document.body !== null) document.body.removeAttribute(BODY_FLAG)
    }

    /**
     * 皮肤生效期间守住 body 标记并维护浮层标记。ui-layout 重挂 body 子树时会把这些
     * 属性一起扔掉，所以在 documentElement 上挂观察者补回来；浮层是动态挂载的，
     * 同一份观察者顺带重扫。最坏情况只是玻璃感短暂消失，token 覆盖仍在，
     * 不会出现半张皮肤的中间态。
     * @returns 停止观察的 disposer。
     */
    function watchBody() {
      markBody()
      markOverlays()
      if (typeof MutationObserver === 'undefined') {
        return () => {
          clearOverlays()
          clearBody()
        }
      }
      let scheduled = false
      const rescan = () => {
        if (scheduled) return
        scheduled = true
        // 合并同一批变更，避免连续 DOM 变更把重扫打成同步死循环。
        Promise.resolve().then(() => {
          scheduled = false
          if (document.body === null) return
          if (!document.body.hasAttribute(BODY_FLAG)) markBody()
          clearOverlays()
          markOverlays()
        })
      }
      const observer = new MutationObserver(rescan)
      observer.observe(document.documentElement, { childList: true, subtree: true })
      return () => {
        observer.disconnect()
        clearOverlays()
        clearBody()
      }
    }

    /** 等 body 出现再打标记：插件可能在 body 之前就被物化。 */
    function whenBodyReady(run) {
      if (document.body !== null) {
        run()
        return
      }
      if (typeof MutationObserver === 'undefined') return
      const observer = new MutationObserver(() => {
        if (document.body !== null) {
          observer.disconnect()
          run()
        }
      })
      observer.observe(document.documentElement, { childList: true })
    }

    /**
     * 客户端插件入口。
     * @param ctx - 客户端 cordis context（只用到 `ctx.theme` 与 `ctx.effect`）。
     */
    function apply(ctx) {
      const theme = ctx.theme
      if (theme === undefined || theme === null || typeof theme.overrideTokens !== 'function') {
        console.warn('[dsh-frost-ice] 找不到主题服务（需要 @deepseek-ai/dsh-client-ui-theme），皮肤已跳过。')
        return
      }

      // token 覆盖层：卸载时由主题服务自己摘掉。
      ctx.effect(() => theme.overrideTokens(name, TOKENS), 'dsh-frost-ice: token layer')

      // 样式表 + body / 浮层标记：都随插件卸载一起回收。
      ctx.effect(() => {
        injectStyle()
        let stopWatch = () => {}
        whenBodyReady(() => {
          stopWatch = watchBody()
        })
        return () => {
          stopWatch()
          removeStyle()
        }
      }, 'dsh-frost-ice: stylesheet')

      // 主题快照里出现本皮肤的 token 就说明覆盖层装上了；顺手挂排查助手。
      ctx.effect(() => {
        window.__dshFrostIce = { inspect, tokens: TOKENS, css: CSS, version: '0.2.0' }
        if (typeof ctx.on !== 'function') {
          return () => {
            delete window.__dshFrostIce
          }
        }
        const off = ctx.on('theme/change', (snapshot) => {
          const anchor = snapshot?.active?.tokens?.[ANCHOR]
          if (typeof anchor === 'string' && anchor.indexOf('247, 252, 255') >= 0) {
            console.info('[dsh-frost-ice] 冰蓝磨砂皮肤已生效。')
          }
        })
        return () => {
          off()
          delete window.__dshFrostIce
        }
      }, 'dsh-frost-ice: theme log')
    }

    exports.name = name
    exports.inject = inject
    exports.apply = apply
    exports.TOKENS = TOKENS
    exports.CSS = CSS
    return module.exports
  },
})
