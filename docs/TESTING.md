# 测试与验收 / Testing

本报告记录实际完成的验证，避免把模拟事件误称为实机输入。

## 自动化结果

环境：Windows，Node.js 24.22.1，Windows PowerShell 5.1；日期 2026-11-05。

- `node --test`：**92 项通过，0 失败**（规则、jsdom 编辑适配、框架接口模拟、原安装器、两个新入口的安装逻辑、界面配置迁移与命令行入口调用）。
- `node scripts/check.mjs`：JavaScript/PowerShell 语法与 manifest/package 版本一致性通过。
- `test/installer.integration.ps1`：自定义含空格路径中的首次安装、升级、精确备份、回滚、卸载、保留偏好及显式清除偏好均通过。
- `scripts/verify-package.ps1`：解压后的发布包根目录两个入口齐全，第二步安装成功、自动登记启用并恢复原生布局配置，安装文件哈希与包内载荷一致。
- 安装脚本测试使用隔离的假框架目录，屏蔽测试作用域中的进程检测；后续编辑器测试另外使用程序副本和隔离配置。原有 Typora 安装和用户笔记未改动。
- 最终 bundle `main.js`：**15,270 字节（14.91 KiB）**。ZIP 尺寸由打包命令输出；校验值见 `dist/SHA256SUMS.txt`。

自动化涉及：同行句号/问号/感叹号、双空格、引号括号、段落/列表开头、小数、缩写、I 及四种缩写、词内 i、品牌词、URL/email/标识符；原始与 DOM 数学/代码保护、混排；开关、局部编辑、选区、光标移动、Shift、DOM 替换、零宽符、IME 事件、原生剪贴板/删除/撤销重做事件透传、清理监听和 API 失败暂停。

**重要区别：** jsdom 的插入函数与框架持久化使用测试桩，不包含真实 Typora 的撤销栈、排版器、IME、文件写盘或插件加载器。撤销重做测试证明事件不被截获，不证明真实撤销分组或恢复内容正确。框架生命周期测试证明接口使用与偏好恢复逻辑，不证明真实退出后磁盘已写入。

## 本机核查

- 从本机 `resources/package.json` 确认 Typora **1.14.10**。
- 阅读本机 editor 源码，核实原生插入/undo 路径、beforeinput、公式类名及源码模式；不分发 Typora 源码。
- 初次 computer-use 检查遇到 DevTools 粘贴提示，未绕过该提示。后续改用正常插件加载路径，在工作区的程序副本和全新配置中进行测试。
- **真实编辑器程序化集成通过**：Typora 1.14.10 + Community Plugin 2.10.86 + AutoCaps 0.1.0。
- 6 组逐字符程序化输入均正确：同行句号、问号/感叹号、I 与缩写、品牌词、URL/email、新建公式与正文连续混排；状态保持 ON。
- 原生撤销栈测试：`Hello. iPhone and I am fine?` 撤销至空文档，再重做恢复完全一致。该程序化样例用了 7 次撤销；不保证物理键盘输入具有相同分组。
- 真实行内数学 DOM 的编辑 `script`、行内代码未被截获，源码不变；块公式源码正确并存在受保护的 CodeMirror DOM；源码模式暂停通过；OFF 时保留小写通过。
- 框架将 `enabled=false` 写入真实配置文件；独立配置重启后初始状态为 OFF，验证了持久化。
- 证据摘要见 [NATIVE_TEST_RESULTS.json](NATIVE_TEST_RESULTS.json)。复现工具见源码包 `tools/native-probe/README.md`，它只允许带专用标记的隔离配置。
- 测试使用构造的 `beforeinput`（含 target ranges）以及 Chromium 默认插入模拟；插件修正仍通过真正的 Typora API，DOM、撤销栈和配置服务均未模拟。这不等同于真实键盘、Ctrl 快捷键或 IME 候选窗口验收。
- 原有用户文档未编辑，原有安装目录的 `window.html` 与测试副本的原始备份哈希相同。

### 0.1.1 两入口与自动启动验收

- 在新的隔离用户目录，第一步从官方 GitHub 实际下载 2.10.86 框架 ZIP，SHA-256 与锁定值一致；自动安装框架、备份原 HTML 并加入加载钩子。
- 第二步自动复制 AutoCaps 0.1.1，并将全局插件启用登记及 `settings.enabled` 写成 true；没有手动勾选 AutoCaps。
- 将原解压文件夹移走，再启动真实 Typora 副本：`instanceLoaded=true`、`enabled=true`、`AutoCaps: ON`，运行文件位于用户数据目录。
- 彻底关闭测试实例后再次启动：上述结果再次通过。证明正常启动不依赖下载文件夹或再次运行入口。
- 11 项新增测试覆盖新安装、重复安装、其他插件及独立设置保留、错误 JSON、错误 SHA-256、未安装框架、Typora 未退出、受保护目录、冲突框架、HTML 恢复版本保护，以及从不同工作目录调用两个中文 CMD 入口并正确返回失败状态。CMD 已统一为 UTF-8 无 BOM + CRLF，并加入静态检查。
- 实际 UAC 同意界面没有自动操作；自动测试已验证无写权限时会进入提权分支/明确失败，尚需人工确认系统权限弹窗体验。
- 证据摘要：[AUTO_INSTALL_TEST_RESULTS.json](AUTO_INSTALL_TEST_RESULTS.json)。0.1.1 未改动输入运行时代码，继续使用此前原生编辑器集成结果。

### 0.1.2 保持原生布局验收

- 新安装默认写入 `showRibbon=false` 与 `internalPlugin.enabledPlugins["internal.workspace"]=false`。升级测试模拟 0.1.1 的安装记录，确认第 2 步关闭两项、精确保留其他设置，并备份原 `core.json`。
- 新增 4 项回归测试：旧版界面迁移与备份、独立框架的界面偏好保留，以及两种损坏/结构异常配置的拒绝处理。与其余测试合计 92 项。
- 在真实 Typora 1.14.10 副本的全新配置中通过两个安装动作部署 0.1.2，未手动调整框架外观。DOM 验证：图标栏元素及其 body 类均不存在、多标签工作区元素不存在、正文左坐标为 0；程序化展开原生侧栏后，其原生标签头仍可见。
- 在上述布局下重跑全部原生编辑器探针：6 组输入、正文/数学混排、行内/块数学、代码、源码模式、OFF 与原生撤销重做全部通过；重启后布局仍保持，OFF 偏好正确恢复。
- 证据摘要：[NATIVE_APPEARANCE_TEST_RESULTS.json](NATIVE_APPEARANCE_TEST_RESULTS.json)。这是实际渲染器/DOM 与程序化输入验证，未替代物理键盘或人工截图验收。
- 应用户要求，在其退出 Typora 后，单独备份并修正当前框架的上述两项配置；未改主题、笔记或 AutoCaps 开关偏好。发布测试本身仍使用隔离副本。

## 真实键盘与 IME 人工验收清单（仍待验）

准备：使用当前版本的副本笔记；记录 OS、Typora、core、AutoCaps 和输入法版本。安装框架与插件，启用行内数学，关闭其他输入增强插件。每一行必须**实际逐字键入**，不要粘贴代替键盘测试。测试文件可从 `test/manual-cases.md` 复制结构，但待输入样例须手输。

| 检查 | 操作 | 验收标准 | 状态 |
| --- | --- | --- | --- |
| 首次安装 | ZIP 解压 → 根目录入口 1 → 入口 2 → 重启 | 自动 ON，无需设置勾选；UAC 提示正常 | 程序化通过，双击/UAC 待验 |
| 原生外观 | 新安装或 0.1.1 升级后重启，展开/收起侧栏 | 无新增图标栏/标签页，原生侧栏与主题保留 | DOM 程序化通过，人工外观待验 |
| 同行句号 | 输入 `hello. how are you?` | 首个 h、句号空格后的 h 立即大写 | 待验 |
| 同行问号/感叹号 | 输入 `are you okay? i am fine! that is good.` | I、That，无需回车 | 待验 |
| 空格/引号 | 输入 `hello.  “how are you?”` | 保留空格与引号，How | 待验 |
| 段落/列表 | 连续两段、两项无序/有序列表 | 每项首字母大写；列表不损坏 | 待验 |
| I / 缩写 | `today i feel happy. i'm ready. i've finished. i'll go. i'd try.` | I、I'm、I've、I'll、I'd | 待验 |
| 弯引号 | 启用智能引号或键入 `i’m / i’ve / i’ll / i’d` | 仅首字母变化，引号正确 | 待验 |
| 瞬时与连续输入 | 输入 i，停留，再输入 n；输入 iPhone | 句中 I 后续恢复 in；iPhone 大小写保持 | 待验 |
| URL/email | 从段首逐字输入 `https://example.com/i` 和 `hello@example.com` | 最终大小写与原始一致，链接完整 | 待验 |
| 小数/缩写 | `value 3.14 and dr. smith, e.g. this.` | 不误分割小数/缩写 | 待验 |
| 行内公式 | 输入 `$f(x)=ax+b$`、`$i$`，进入/退出编辑 | 公式源码完全一致，不仅检查渲染 | 待验 |
| 块公式 | $$ 块及 Typora 支持的数学输入方式；输入积分/变量 i | 字符大小写完全一致 | 待验 |
| 未闭合公式 | `$i am`、`\[ i f(x)` 尚未闭合 | 不大写公式内容 | 待验 |
| 混排 | `i think $f(x)=ax+b$ is interesting. it is linear.` | 正文 I/It，公式逐字符不变 | 待验 |
| 代码 | 行内反引号、围栏 JS/Python、代码块中的 i | 不改大小写，不改缩进 | 待验 |
| HTML/link | 编辑属性、URL、自动链接、Markdown 链接 | 保持原样；标签文本也跳过 | 待验 |
| 源码模式 | Ctrl+/ 切换；输入示例；切回正文 | 源码模式整模式暂停，正文恢复 | 待验 |
| 光标编辑 | 中途点击、方向键、Home/End，再打字 | 只处理新输入，不回扫文档 | 待验 |
| 删除/选区 | Backspace/Delete、选中词后覆盖 | 不复活删除内容、不改选区替换 | 待验 |
| 剪贴板 | 复制/剪切/粘贴包含公式与小写的段落 | 原样输入；剪贴板不改写 | 待验 |
| 撤销重做 | 键入 Hello. How? I am iPhone；反复 Ctrl+Z、Ctrl+Y | 每步内容与光标合理，能回到空文档并恢复，无丢字/重复 | 待验 |
| IME | 中文拼音候选、选词/取消、中英切换后输入英文 | 合成期间无改写；直接英文输入恢复 | 待验 |
| 自动配对 | 启用括号/智能引号，快速输入 | 不吞括号，不重复标点，光标正确 | 待验 |
| 两种规则 | 分别开关句首/I；完全 OFF | 仅启用的规则生效 | 待验 |
| 状态保存 | OFF，等 2 秒，退出所有窗口后重开 | 仍 OFF；快捷键自定义恢复 | 待验 |
| 升级/卸载 | 升级 → 回滚 → 卸载 → 重开 | 偏好保留、无残留监听、其他插件正常 | 待验 |
| 快速输入/大块 | 长按按键、大段>4096字符、多个格式跨度 | 不丢字；超预算时跳过 | 待验 |

记录通过时附上版本及结果，失败时保留脱敏复现。以上清单完成前不要将当前版本宣传为稳定版。

## 复现

```sh
pnpm install --frozen-lockfile
node --test
node scripts/check.mjs
node scripts/build.mjs
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File test/installer.integration.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pack.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-package.ps1
```

安装脚本测试保留 `.test-output/` 下的隔离结果供检查，该目录和 `.research/` 不进入 Git 或安装包。
