# Bug 修复与功能迭代记录

按 git commit 倒序整理，每条记录包含：问题根因 → 修复方案 → 技术要点。

---

## ca80afd — ♻️ 自动选择分组展开时不显示节点

**问题**：`♻️ 自动选择` 代理组的 `autoAllNodes: true`，内部 `proxies: []` 为空数组。展开该分组时，UI 走了 `group.proxies.length === 0` 分支，显示"暂无节点，点击下方批量添加"，误导用户认为节点没有被选中。

**根因**：`autoAllNodes` 是"虚拟引用"设计——不在 `proxies[]` 中存储具体节点名，而是在生成 YAML 时动态展开。但 UI 只读了 `group.proxies`，没有感知 `autoAllNodes` 标志。

**修复**：

```tsx
// 1. 增加 sourceOnlySections 派生数据（过滤掉代理组自身）
const sourceOnlySections = proxySections.filter((s) => s.label !== '代理组')

// 2. 展开区域：加 autoAllNodes 头部 + 只读节点列表
{group.autoAllNodes && (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50/50 ...">
    <CheckSquare size={12} className="text-emerald-500" />
    <span>自动包含全部导入节点</span>
    <span className="ml-auto">共 {sourceOnlySections.flatMap(s => s.items).length} 个</span>
  </div>
)}

// 3. 空状态文案改为条件判断
{group.proxies.length === 0 && !group.autoAllNodes && (
  <p>暂无节点，点击下方批量添加</p>
)}

// 4. autoAllNodes 时展示只读节点列表（绿色勾选）
{group.autoAllNodes && sourceOnlySections.map((section) => (
  <div key={section.label}>
    <div className="section-header">{section.label}</div>
    {section.items.map((name) => (
      <div key={name} className="text-emerald-700 ...">
        <CheckSquare size={12} /> {name}
      </div>
    ))}
  </div>
))}

// 5. 隐藏批量添加按钮（autoAllNodes 不需要手动添加）
{!group.autoAllNodes && <div className="p-2 border-t ...">...</div>}
```

**经验**：虚拟引用（`autoAllNodes`）设计简化了状态管理（不需要每次订阅源变更后同步），但 UI 层需要显式感知这个标志，否则会出现"数据正确、展示错误"的不一致。

---

## 776d9dd — IP 质量查询功能

**新增背景**：机场节点众多，肉眼难以区分住宅/数据中心/代理 IP，用户需要快速筛选高质量节点。

**技术方案**：
1. **域名 → IP**：通过 Google DoH（`dns.google/resolve`）解析节点 server 字段
2. **IP 质检**：POST 到 `/api/ipinfo`，后端批量查询 ip-api.com
3. **结果缓存**：DNS 缓存 5 分钟，IP 信息缓存 30 分钟（模块级 Map）
4. **UI 过滤**：节点选择器支持按国家代码/类型（住宅/数据中心/代理）过滤

**ip-api.com 字段映射**：

| 字段 | 含义 | 用途 |
|------|------|------|
| `proxy: true` | 已知代理/VPN IP | 标红 "VPN" |
| `hosting: true` | 数据中心 IP | 标橙 "DC" |
| 两者均 false | 住宅 IP | 标绿 "住宅" |
| `countryCode` | 国家代码 | 国旗显示 + 过滤 |

---

## 34e385c — 代理组重命名 Draft 模式 + 重名校验

**问题**：直接绑定 store 的 group.name 到 input，每次 `onChange` 都触发全局级联更新（同步到所有规则/其他分组引用），性能差且中间状态会造成引用混乱。

**修复**：引入 draft 模式

```ts
// 本地 draft，不触发 store 更新
const [nameDraft, setNameDraft] = useState(group.name)
const [nameError, setNameError] = useState('')

const commitName = () => {
  const trimmed = nameDraft.trim()
  // 重名校验
  if (existingNames.includes(trimmed)) {
    setNameError('名称已存在')
    return
  }
  // 无变化，不触发更新
  if (trimmed === group.name) return
  // 提交到 store（触发级联更新）
  onUpdate({ name: trimmed })
}
```

**触发时机**：`onBlur` 或 `Enter` 键。`Escape` 键回滚到 `group.name`。

**经验**：表单 "draft + commit" 模式在需要校验或防止中间状态传播时非常有用，是受控输入组件的标准实践。

---

## 02e580f — 代理组重命名/删除全局级联

**问题**：重命名或删除代理组后，其他代理组的 `proxies[]`、规则的 `target`、规则集的 `target` 没有同步更新，导致生成的 YAML 存在悬空引用（`proxy not found` 警告）。

**修复**：在 `updateProxyGroup` 和 `removeProxyGroup` 中增加级联逻辑（见 01-state-management.md）。

**删除时的安全 fallback**：悬空引用回退到 `DIRECT`（直连），而非删除规则本身，避免破坏规则结构。

---

## 9beebac — 修复 proxy not found 警告

**问题**：生成 YAML 后，Mihomo 报 `proxy not found` 警告，原因是某个代理组引用了不存在的节点名（订阅更新后节点被重命名或删除）。

**修复**：
1. 增加生成前的引用校验（ConfigPreview 显示警告而非静默生成）
2. 初始化默认 `♻️ 自动选择`（url-test 类型）作为 MATCH 规则的目标
3. `autoAllNodes: true` 确保该分组始终包含所有当前节点，不产生悬空引用

---

## e309a3f — Favicon 从 ⚙️ 改为 🚀

**实现方式**：内联 SVG data URI，无需单独的图片文件：

```html
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>" />
```

**优点**：
- 零额外网络请求
- 支持任意 emoji，颜色跟随系统（emoji 本身带色）
- 在所有现代浏览器中支持 SVG favicon
- `viewBox="0 0 100 100"` + `font-size="90"` + `y=".9em"` 是让 emoji 居中的标准写法

---

## ea329ad — GitHub 链接修正 + 页面标题 Emoji

**问题**：链接指向错误分支（`main` 而非 `master`）。

**修复**：更新 `href` 指向 `master` 分支。

**标题 Emoji**：`<title>⚙️ Mihomo Config Editor</title>`，浏览器标签页直接显示 emoji，增强辨识度。
