#!/usr/bin/env node
/**
 * 把「横向溢出修复」应用到 `dsh-providers-hub` 的客户端样式表。
 *
 * ## 用法
 *
 * ```bash
 * node scripts/apply-overflow-fix.mjs <path/to/lib/client/jet-hub.js>
 * ```
 *
 * 典型场景（配合 pnpm patch）：
 *
 * ```bash
 * pnpm patch dsh-providers-hub@<版本>
 * node scripts/apply-overflow-fix.mjs \
 *   "node_modules/.pnpm_patches/dsh-providers-hub@<版本>/lib/client/jet-hub.js"
 * pnpm patch-commit "node_modules/.pnpm_patches/dsh-providers-hub@<版本>"
 * ```
 *
 * ## 为什么按「规则块」而不是整行字符串匹配
 *
 * 上游会调整属性顺序、增加声明（例如 2.8 给 `.dim-jh-panel` 自己加了 `min-width: 0`，
 * 同时把 `display` 挪了位置）。整行锚点一碰就失效，本脚本改为：
 *
 *   · 定位 `.dim-jh-X { ... }` 这条**规则块**（行首锚定，避开
 *     `.dim-jh-panelHost > .dim-jh-page` 这类嵌套选择器）
 *   · 只在块内增补缺失的属性 —— 已有就跳过（幂等）
 *   · 规则块不存在或出现多次 ⇒ 报错退出，不改坏任何东西
 *
 * ## 退出码
 *
 * 0 = 全部满足；1 = 有检查未通过（此时文件可能已改，请先看输出再决定是否提交）。
 */

import { readFileSync, writeFileSync } from 'node:fs'

const target = process.argv[2]
if (!target) {
  console.error('用法: node scripts/apply-overflow-fix.mjs <path/to/lib/client/jet-hub.js>')
  process.exit(2)
}

const original = readFileSync(target, 'utf8')
let src = original
const applied = []
const skipped = []

/**
 * 在指定规则的块里确保存在某条声明。
 * @param selectorRe 规则选择器的正则（不含行首锚定，函数内部会补）
 * @param selectorLabel 报错时显示的名字
 * @param decl 要保证存在的声明，如 `min-width: 0;`
 * @param label 变更日志用的短名
 */
function ensureInRule(selectorRe, selectorLabel, decl, label) {
  const re = new RegExp(`(?:^|\\n)${selectorRe.source}`, 'gm')
  const matches = [...src.matchAll(re)]
  if (matches.length !== 1) {
    throw new Error(`${selectorLabel}: 规则块出现 ${matches.length} 次（预期 1）—— 上游结构变了，需人工核对`)
  }
  const block = matches[0][0]
  if (block.includes(decl)) {
    skipped.push(label)
    return
  }
  src = src.replace(block, block.replace(/\}\s*$/, ` ${decl} }`))
  applied.push(label)
}

/**
 * 确保规则块里是 `flex-wrap: wrap`。
 * 已有 wrap → 跳过；有 nowrap → 改掉；两者都没有 → 直接补上。
 */
function ensureWrap(selectorRe, selectorLabel, label) {
  const re = new RegExp(`(?:^|\\n)${selectorRe.source}`, 'gm')
  const matches = [...src.matchAll(re)]
  if (matches.length !== 1) {
    throw new Error(`${selectorLabel}: 规则块出现 ${matches.length} 次（预期 1）`)
  }
  const block = matches[0][0]
  if (block.includes('flex-wrap: wrap')) {
    skipped.push(label)
    return
  }
  if (block.includes('flex-wrap: nowrap')) {
    src = src.replace(block, block.replace('flex-wrap: nowrap', 'flex-wrap: wrap'))
  } else {
    src = src.replace(block, block.replace(/\}\s*$/, ' flex-wrap: wrap; }'))
  }
  applied.push(label)
}

// ① 打断 min-content 向上传播：整条 flex 祖先链都必须可收缩
ensureInRule(/\.dim-jh-page\s*\{[^}]*\}/, '.dim-jh-page', 'min-width: 0;', 'page min-width:0')
ensureInRule(/\.dim-jh-layout\s*\{[^}]*\}/, '.dim-jh-layout', 'min-width: 0;', 'layout min-width:0')
ensureInRule(/\.dim-jh-panelHost\s*\{[^}]*\}/, '.dim-jh-panelHost', 'min-width: 0;', 'panelHost min-width:0')
ensureInRule(/\.dim-jh-panel\s*\{[^}]*\}/, '.dim-jh-panel', 'min-width: 0;', 'panel min-width:0')

// ② 横向装不下时换行，而不是溢出到容器外
ensureWrap(/\.dim-jh-accountActions\s*\{[^}]*\}/, '.dim-jh-accountActions', '按钮行 wrap')
ensureWrap(/\.dim-jh-metaRow\s+dd\.dim-jh-creditValue\s*\{[^}]*\}/, 'creditValue', '积分行 wrap')

writeFileSync(target, src, 'utf8')

// ── 复核：逐条读回文件确认 ──
const out = readFileSync(target, 'utf8')
const checks = [
  ['.dim-jh-page 含 min-width:0', /(?:^|\n)\.dim-jh-page\s*\{[^}]*min-width:\s*0/m.test(out)],
  ['.dim-jh-layout 含 min-width:0', /(?:^|\n)\.dim-jh-layout\s*\{[^}]*min-width:\s*0/m.test(out)],
  ['.dim-jh-panelHost 含 min-width:0', /(?:^|\n)\.dim-jh-panelHost\s*\{[^}]*min-width:\s*0/m.test(out)],
  ['.dim-jh-panel 含 min-width:0', /(?:^|\n)\.dim-jh-panel\s*\{[^}]*min-width:\s*0/m.test(out)],
  ['accountActions 已 wrap', /(?:^|\n)\.dim-jh-accountActions\s*\{[^}]*flex-wrap:\s*wrap/m.test(out)],
  ['creditValue 已 wrap', /dd\.dim-jh-creditValue\s*\{[^}]*flex-wrap:\s*wrap/m.test(out)],
  ['accountActions 无残留 nowrap', !/(?:^|\n)\.dim-jh-accountActions\s*\{[^}]*flex-wrap:\s*nowrap/m.test(out)],
]

console.log(`本次应用 ${applied.length} 项，跳过（已满足）${skipped.length} 项`)
if (applied.length) console.log('  应用: ' + applied.join('、'))
if (skipped.length) console.log('  跳过: ' + skipped.join('、'))
console.log(`字节 ${original.length} -> ${out.length}`)
for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`)

if (checks.some(([, ok]) => !ok)) process.exitCode = 1
