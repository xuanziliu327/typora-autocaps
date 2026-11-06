# 解决typora中首字母自动大写问题

**Typora AutoCaps**：轻量、本地运行的英文自动大写插件。为 Typora 普通正文补上句首大写与代词 **I**，保护公式和代码。

[English](README_EN.md) · [测试与验收](docs/TESTING.md) · [架构与调研](docs/ARCHITECTURE.md) · [更新记录](CHANGELOG.md)

[下载 Windows 安装包（0.1.3）](https://github.com/xuanziliu327/typora-autocaps/releases/download/0.1.3/typora-autocaps-0.1.3-windows.zip) · [GitHub Releases](https://github.com/xuanziliu327/typora-autocaps/releases) · [反馈问题](https://github.com/xuanziliu327/typora-autocaps/issues)

**0.1.3 为预发布版本。解压 Windows 安装包后，依次运行根目录的两个入口，再彻底重启 Typora，即可默认启用。自动化与 Typora 1.14.10 程序化集成测试已通过；真实键盘、快捷键与 IME 候选窗口的人工验收仍待完成。**

| 输入 | 输入过程中显示 |
| --- | --- |
| `hello. how are you?` | `Hello. How are you?` |
| `yes! that is correct.` | `Yes! That is correct.` |
| `today i feel happy.` | `Today I feel happy.` |
| `i'm happy. i've finished.` | `I'm happy. I've finished.` |
| `you and i` | `You and I` |
| `i think $f(x)=ax+b$ is linear. it is simple.` | `I think $f(x)=ax+b$ is linear. It is simple.` |

## 特性

- 同行 `. ? !` 后立即大写，支持连续空格、引号、括号、新段落和列表项。
- 独立 `i` 和 `i'm / i've / i'll / i'd` 自动大写；支持弯引号。
- 当前词继续形成 `iPhone`、`iPad`、网址、邮箱、下划线标识符时，恢复插件暂时改过的首字母。
- 跳过行内/块级数学、代码、HTML、链接、源码模式和未知编辑区域。未闭合的公式也采用保守保护。
- 状态栏 `AutoCaps: ON / OFF`，一键切换；默认快捷键 `Ctrl+Alt+U`。
- 通过本项目首次安装的框架默认关闭额外图标栏、多标签工作区，保留 Typora 原生侧栏与编辑布局。
- 句首和代词规则可以分别关闭，偏好由框架保存。
- 无运行时第三方包、网络请求、遥测、后台服务、轮询或全局键盘监听；仅处理当前小段落。

## 支持范围

| 项目 | 范围 |
| --- | --- |
| 首要目标 | Windows 10/11，Typora 1.14.x |
| 本地源码与程序化集成核查 | Typora 1.14.10 |
| 宿主框架 | [Typora Community Plugin](https://github.com/typora-community-plugin/typora-community-plugin) **2.10.86 或更新的兼容版本** |
| 人工键盘/IME 验收 | 尚未完成；已测程序化环境见测试文档，版本范围不等于完整验证矩阵 |
| macOS / Linux / 旧版 Typora | 本版不声明支持 |

这是第三方扩展，Typora 没有官方稳定插件 API。AutoCaps 不打包宿主框架，也不宣称框架本身零开销。不要同时安装两套注入框架来运行本插件。

## 安装

从 [GitHub Releases](https://github.com/xuanziliu327/typora-autocaps/releases/tag/0.1.3) 下载 **`typora-autocaps-0.1.3-windows.zip`** 并完整解压。普通用户请选择 Windows 安装包；`Source code` / `source.zip` 是开发源码，需要自行构建。

```text
解压后的根目录/
├── 1-安装框架.cmd       ← 第一次使用先双击这个
├── 2-安装AutoCaps.cmd   ← 然后双击这个
├── README.md
├── installer/
├── main.js
└── manifest.json
```

1. 保存笔记并彻底退出所有 Typora 窗口。
2. 双击 **`1-安装框架.cmd`**。脚本自动检测 Typora，从官方 GitHub 下载固定版本的框架 ZIP并核对 SHA-256，安装到用户数据目录，备份后写入标准启动加载钩子。程序目录需要管理员权限时，Windows 会显示 UAC 提示。
3. 双击 **`2-安装AutoCaps.cmd`**。脚本复制插件并自动启用，保留其他插件配置；**无需打开设置勾选插件**。
4. 重新启动 Typora，底部出现 **AutoCaps: ON** 即完成。以后随 Typora 自动加载，不用再运行入口；安装成功后可以移走或删除解压文件夹。

两个入口均可重复运行。已安装兼容框架时，第 1 步会保留它；以后更新 AutoCaps 通常只需再运行第 2 步。无需 Node.js、Python、环境变量设置或编辑配置文件。脚本使用的 PowerShell 执行策略仅对当前进程生效。

**保持原生外观**：首次通过本安装包安装框架时，会用框架自身设置关闭左侧图标栏和多标签工作区，不更换主题或注入隐藏样式。使用 0.1.1 两入口安装后出现额外侧栏的用户，退出 Typora，再运行新版第 2 步即可修复，修改前会备份 `core.json`。独立安装过框架的用户保留其现有界面偏好。

**找不到路径**：脚本会读取运行进程、注册表、PATH 和常见目录；无法唯一定位时显示选择或要求输入 `Typora.exe` 的路径。第二步会记住第一步选定的位置。

**离线/下载失败**：手动下载官方 [2.10.86 框架 ZIP](https://github.com/typora-community-plugin/typora-community-plugin/releases/download/2.10.86/typora-community-plugin.zip)，命名为 `typora-community-plugin.zip` 放到解压包根目录，再运行第 1 步；仍会验证固定 SHA-256。安装器只提取框架 JS/CSS/JSON，不运行下载包里的安装脚本或 EXE。

**Typora 升级后**：如果本体升级覆盖了启动钩子，重新运行第 1 步即可修复；插件与偏好通常仍在用户目录中。不要用旧版本的 HTML 覆盖新 Typora。

**手动安装**：`plugin.zip` 仍保留标准独立插件格式，供现有框架用户复制安装/市场分发。目前未上架市场。手动复制后须自行启用；推荐普通用户使用根目录两个入口。

## 使用

**0.1.3 修复首字符漏大写**：若旧版需要先按 Enter，退出 Typora 后运行新版 `2-安装AutoCaps.cmd` 更新即可，无需重装框架。

点击底部 **AutoCaps: ON / OFF**，或在正文中按 `Ctrl+Alt+U`。状态栏支持 Enter/空格键操作；框架命令面板（F1）也有 `Typora AutoCaps: Toggle`。

- `Ctrl+.` → **AutoCaps**：分别启用 Sentence Capitalization、Pronoun I Capitalization。
- `Ctrl+.` → **Hotkeys**：搜索 `Typora AutoCaps: Toggle`，录入自定义快捷键。
- 修改偏好后等待约一秒再退出，让框架完成写盘。使用库级配置时，偏好跟随框架当前配置作用域；多个 Typora 窗口不会即时同步。
- `AutoCaps: PAUSED` 表示编辑 API 异常，本次会话已停用处理。检查刚输入的字符，重新启动 Typora并提交 Issue。

## 更新、回滚与卸载

**更新**：退出 Typora，解压新版本，运行根目录 `2-安装AutoCaps.cmd`。自动启用插件，保留句首/I 的独立设置和其他配置；需要保持 OFF 的开发者可使用 `installer/Install.cmd`。旧版插件与修改前的配置备份保存在 `<框架目录>/autocaps-backups/`，安装输出会显示路径。

**回滚**：退出 Typora，运行 `installer/Restore.cmd`，输入旧版插件备份路径。框架的原始 HTML 备份在 `<Typora用户数据目录>/autocaps-framework-backups/`；`installer/RestoreFramework.cmd` 可恢复该 HTML（受保护目录需右键以管理员身份运行）。若 Typora 本体已更新，恢复器会拒绝覆盖新 HTML。

**卸载**：退出 Typora，运行 `installer/Uninstall.cmd`；或使用框架“已安装插件”里的 Uninstall。两者默认保留插件偏好。完全清理时删除以下**仅属于 AutoCaps** 的文件：

- `<框架目录>/settings/data/typora-autocaps.json`（全局偏好）。也可运行 `Manage.ps1 -Action Uninstall -PurgeSettings`。
- 如果启用了库级配置：相应库的 `.typora/data/typora-autocaps.json`。
- 不再需要的 `<框架目录>/autocaps-backups/` 备份。
- 如自定义过快捷键，在框架 Hotkeys 中恢复该命令默认设置；不要删除整个框架配置文件。

不再使用宿主框架时，按其 [官方卸载说明](https://github.com/typora-community-plugin/typora-community-plugin/blob/main/docs/en-us/user-guide/1b-uninstall.md) 操作。`RestoreFramework.cmd` 仅恢复启动 HTML，框架数据仍保留；AutoCaps 的卸载入口不卸载其他插件。

## 边界与已知问题

- 句号后需要空格才能视为新句子，**第一段无需先按回车**。`fantacy.derea.queue.` 这类无空格的点分文本按可能的网址/标识符保护，会恢复暂时大写的首字母；`fantacy. derea. queue.` 则立即成为 `Fantacy. Derea. Queue.`。
- 只处理当前逐字符输入，不整理旧文档；粘贴、拖放、选区覆盖、IME 合成及自动拼写替换保持原样。中文输入法提交的英文不会被自动处理。
- `i` 会先暂时显示为 `I`。紧接着输入 `n` 会恢复成句中的 `in`；输入 `Phone` 会恢复 `iPhone`。光标移动、点击、删除、粘贴、失焦、IME 或跨格式边界会结束追踪，此后不再追改该词。因此先输入 `i`、移开光标再续写 `Phone`，可能保留 `IPhone`。
- 缩写和技术文本使用保守启发式，不是英语语义分析。`etc.` 位于真正句尾时，下一词可能不大写；自然语言中的单字变量 `i` 无法与代词区分，请用数学/代码标记或关闭代词规则。
- 中英文混合的同一段落不会寻找“任意位置第一个英文词”；只有明确句首才大写。Markdown 链接标签也整段跳过。
- 超过 **4096 UTF-16 字符**或 **256 个 DOM 节点**的当前块、未知结构、跨节点替换和超过 128 字符的当前词会停止处理。列表、表格和复杂格式的行为仍需实机核查。
- Typora 原生插入 API 会创建编辑事务，撤销分组可能比普通输入更细。程序化测试已验证原生撤销栈可退回空文档并重做恢复，实际 Ctrl+Z/Ctrl+Y 键盘操作仍待验收。API 异常时可能需要重新输入触发异常的字符；插件暂停，不进行可能重复写入的重试。
- 没有可保证的跨版本 DOM/API 契约。不要把“没有命中已知保护条件”理解为任意第三方主题/插件组合均已验证。运行在未知区域时保守跳过。

## 开发与发布

开发需要 Node.js 20+ 与 pnpm 11.25.0（pnpm 自身的 Node 版本要求以其发行版本为准；CI 使用 Node 24）。**用户安装插件不需要它们。**

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run check
pnpm run build
```

Windows 下打包及安装脚本测试：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File test/installer.integration.ps1
pnpm run pack
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-package.ps1
```

产物：`dist/plugin.zip`、`dist/typora-autocaps-0.1.3-windows.zip`、`dist/typora-autocaps-0.1.3-source.zip`、`dist/SHA256SUMS.txt`。核心 `main.js` 为 **16,637 字节（16.25 KiB）**，无运行时 npm 依赖；开发测试仅直接依赖 `jsdom`。框架不打进插件包，由第一个入口安装。

可复现的真实编辑器集成测试说明位于源码包 `tools/native-probe/README.md`，准备脚本只创建隔离的程序副本和新配置目录。

GitHub Actions 在推送与 PR 上测试，在推送版本标签（如 `0.1.3`）时生成 **Draft Release**，供维护者验收后发布。项目仓库为 [xuanziliu327/typora-autocaps](https://github.com/xuanziliu327/typora-autocaps)，manifest 已填写真实仓库与作者链接；后续发布及市场登记见 [RELEASING.md](docs/RELEASING.md)。

## 反馈

在你下载本插件的 GitHub 仓库打开 **Issues → Bug report**，提供 Typora/框架/插件版本、系统、输入法、最小复现步骤以及是否处于公式或代码区域。使用脱敏样例，不要附带私人笔记。对于输入异常，先关闭 AutoCaps 再继续编辑。

MIT License。
