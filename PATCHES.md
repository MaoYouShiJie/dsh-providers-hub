# 改动记录

本项目在上游 [iJetLi/dsh-providers-hub](https://github.com/iJetLi/dsh-providers-hub) 的基础上维护。
本文件记录**相对上游基线的全部改动**，用于对上更新时对照迁移。

| 项 | 值 |
|---|---|
| 上游基线 | `dsh-providers-hub@2.8.261028` |
| 许可证 | MIT，`Copyright (c) 2026 Jet`（`LICENSE` 原样保留）|
| 本次改动 | 6 条 CSS + 1 处凭据脱敏 |
| 未改动 | 任何认证、请求、积分、模型目录、RPC、宿主侧逻辑 |

---

## 1. 客户端样式：修复账号卡片横向溢出（6 条）

全部位于 `lib/client/jet-hub.js` 的 `STYLES` 模板字符串。

### 1.1 `.dim-jh-page` — 加 `min-width: 0`

```diff
-.dim-jh-page { display: flex; flex-direction: column; height: 100%; }
+.dim-jh-page { display: flex; flex-direction: column; height: 100%;  min-width: 0; }
```

### 1.2 `.dim-jh-layout` — 加 `min-width: 0`

```diff
-.dim-jh-layout { display: flex; flex: 1; overflow: hidden; }
+.dim-jh-layout { display: flex; flex: 1; overflow: hidden;  min-width: 0; }
```

### 1.3 `.dim-jh-panelHost` — 加 `min-width: 0`

```diff
-.dim-jh-panelHost { box-sizing: border-box; height: 100%; min-height: 0; display: flex; flex-direction: column; padding: 28px 24px 24px; }
+.dim-jh-panelHost { box-sizing: border-box; height: 100%; min-height: 0; display: flex; flex-direction: column; padding: 28px 24px 24px;  min-width: 0; }
```

### 1.4 `.dim-jh-panel` — 加 `min-width: 0`（上游 2.8 已自带，此处保持一致）

```diff
-.dim-jh-panel { flex: 1; padding: 24px; overflow-y: auto; }        /* 2.7 及更早 */
+.dim-jh-panel { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 24px; overflow-y: auto; }   /* 2.8 上游自带 */
```

### 1.5 `.dim-jh-accountActions` — `nowrap` → `wrap`

```diff
-.dim-jh-accountActions { display: flex; flex-direction: row; flex-wrap: nowrap; justify-content: flex-end; gap: 8px; ... }
+.dim-jh-accountActions { display: flex; flex-direction: row; flex-wrap: wrap; justify-content: flex-end; gap: 8px; ... }
```

### 1.6 `.dim-jh-metaRow dd.dim-jh-creditValue` — 加 `flex-wrap: wrap`

```diff
-.dim-jh-metaRow dd.dim-jh-creditValue { display: flex; flex-direction: row; align-items: baseline; gap: 6px; overflow: visible; }
+.dim-jh-metaRow dd.dim-jh-creditValue { display: flex; flex-direction: row; align-items: baseline; gap: 6px; overflow: visible;  flex-wrap: wrap; }
```

### 为什么要改这些

```
昵称用 white-space: nowrap ⇒ 最小内容宽度 = 整串昵称宽度
        ↓
祖先默认 min-width: auto ⇒ 不肯收缩到内容最小宽度以下
        ↓
最小宽度一路上推：卡片 → panel → page = 702px（宿主只有 560px）
        ↓
.dim-jh-layout { overflow: hidden } 静默裁掉右侧，按钮跑到可视区外且无滚动条
```

浏览器实测（真实插件 CSS + 真实卡片 DOM）：

| 场景 | `.dim-jh-page` 宽 | 卡片宽 | 「删除」按钮在可视区内 |
|---|---|---|---|
| 未修复（flex 宿主 560px）| **702 px** | 413 px | ❌ |
| 只加 `.dim-jh-panel{min-width:0}` | 702 px | 413 px | ❌ **无效** |
| **加 `.dim-jh-page{min-width:0}`** | **560 px** | **271 px** | ✅ |
| 修复后（grid / block 宿主）| 560 px | 271 px | ✅ |

关键点：**只加 `panel` 没用**，膨胀发生在更外层的 `page`；必须把整条 flex 祖先链设为可收缩。

### 如何应用到新版本

`scripts/apply-overflow-fix.mjs` 按**规则块**操作（不依赖整行字符串匹配），因此上游调整属性顺序也不会失效：

```bash
node scripts/apply-overflow-fix.mjs <path/to/lib/client/jet-hub.js>
```

- 已满足的规则自动跳过（幂等）
- 上游若自行修好某一项，不报错
- 规则块缺失或重复 ⇒ 报错退出，不会改错地方

## 2. 凭据脱敏：Google OAuth client（1 处）

```diff
-export const GEMINI_DEFAULT_CLIENT_ID = '1071006060591-...apps.googleusercontent.com';
-export const GEMINI_DEFAULT_CLIENT_SECRET = 'GOCSPX-...';
+export const GEMINI_DEFAULT_CLIENT_ID = '';
+export const GEMINI_DEFAULT_CLIENT_SECRET = '';
```

`lib/gemini-oauth.js` 与 `lib/gemini-oauth.d.ts` 同步处理。

**原因**：上游把这对 Google OAuth client 硬编码在源码里，GitHub Push Protection 会判为泄漏密钥并拒绝推送。

**影响范围**：仅「Gemini Code Assist 免配置登录」；其余 22 个供应商不受影响。

**恢复方式**（上游实现本就是 env 优先，见 `geminiClientId()` / `geminiClientSecret()`）：

```bash
export CMDC_PAK_GOOGLE_CLIENT_ID=<client id>
export CMDC_PAK_GOOGLE_CLIENT_SECRET=<client secret>
```

> 定性说明：这对凭据本就随公开 npm 包分发，置空**不是安全修复**，只是为了让仓库能通过自动密钥扫描。

---

## 对本项目的要求

- 修改 `lib/**` 时同步更新 `src/**`（上游把 TS 源码一并发布），否则下次构建会覆盖改动
- 新增改动请追加到本文件，注明基线版本，便于下游对照上游更新
- `LICENSE` 与版权声明必须保留（MIT 要求）
