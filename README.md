# Typora AutoCaps

轻量、本地运行的英文自动大写插件。为 Typora 普通正文补上句首大写与代词 **I**，保护公式和代码。

[English](README_EN.md) · [测试与验收](docs/TESTING.md) · [架构与调研](docs/ARCHITECTURE.md) · [更新记录](CHANGELOG.md)

**0.1.0 是首个预发布版本。自动化测试及 Typora 1.14.10 中的程序化集成测试已通过，包括公式混排、原生撤销重做和重启持久化；真实键盘、快捷键与 IME 候选窗口的人工验收仍待完成。请先在测试文档中试用。**

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

### 第一次使用：先安装框架（只需一次）

1. 保存文件并完全退出 Typora。
2. 从框架的 [Releases](https://github.com/typora-community-plugin/typora-community-plugin/releases) 下载 `typora-community-plugin.zip` 并解压。
3. 在 Typora 安装目录找到 `resources/window.html`，**先将它复制到安全位置作为备份**。如安装路径不同，按官方安装说明定位文件。框架安装会修改这个文件。
4. 按 [官方 Windows 安装说明](https://github.com/typora-community-plugin/typora-community-plugin/blob/main/docs/en-us/user-guide/1a-installation.md) 运行包中的 `install-windows.ps1`，按提示选择实际安装路径。若程序目录需要管理员权限，按官方说明操作。
5. 启动 Typora，确认 `Ctrl+.` 可以打开插件设置，然后退出 Typora。

框架失败时：退出 Typora，将备份复制回**原来的同版本** `window.html` 路径，再按官方说明排查。Typora 升级后不要恢复旧版 HTML，应按框架官方升级说明重新安装。AutoCaps 安装器不会下载或运行框架安装程序。

### 安装 AutoCaps

1. 从本项目 GitHub Releases 下载 `typora-autocaps-0.1.0-windows.zip`，**完整解压**。
2. 完全退出 Typora，双击 `installer/Install.cmd`。
3. 重启 Typora，`Ctrl+.` → **Installed Plugins / 已安装插件** → 勾选 **Typora AutoCaps**。

安装器自动寻找 `%USERPROFILE%\.typora\community-plugins` 或 `%APPDATA%\Typora\plugins`；找不到时可以输入包含 `loader.js` 的框架目录。无需 Node.js、Python 或编辑配置文件。脚本使用的执行策略仅对当前 PowerShell 进程生效，不修改系统策略。

**复制安装（离线同样可用）**：将 `plugin.zip` 中的 `main.js`、`manifest.json` 解压到 `<框架目录>/plugins/typora-autocaps/`，文件直接位于这个目录下，然后在已安装插件中启用。`plugin.zip` 供框架生态分发使用；目前未上架市场，也不声称框架存在 ZIP 导入按钮。

## 使用

点击底部 **AutoCaps: ON / OFF**，或在正文中按 `Ctrl+Alt+U`。状态栏支持 Enter/空格键操作；框架命令面板（F1）也有 `Typora AutoCaps: Toggle`。

- `Ctrl+.` → **AutoCaps**：分别启用 Sentence Capitalization、Pronoun I Capitalization。
- `Ctrl+.` → **Hotkeys**：搜索 `Typora AutoCaps: Toggle`，录入自定义快捷键。
- 修改偏好后等待约一秒再退出，让框架完成写盘。使用库级配置时，偏好跟随框架当前配置作用域；多个 Typora 窗口不会即时同步。
- `AutoCaps: PAUSED` 表示编辑 API 异常，本次会话已停用处理。检查刚输入的字符，重新启动 Typora并提交 Issue。

## 更新、回滚与卸载

**更新**：退出 Typora，解压新版本，运行新的 `Install.cmd`。只替换两个插件文件，不覆盖偏好。旧版备份保存在 `<框架目录>/autocaps-backups/<时间戳>/`，安装输出会显示完整路径。

**回滚**：退出 Typora，运行 `Restore.cmd`，输入安装输出中的备份路径。恢复前也会备份当前版本。

**卸载**：退出 Typora，运行 `Uninstall.cmd`；或使用框架“已安装插件”里的 Uninstall。两者默认保留插件偏好。完全清理时删除以下**仅属于 AutoCaps** 的文件：

- `<框架目录>/settings/data/typora-autocaps.json`（全局偏好）。也可运行 `Manage.ps1 -Action Uninstall -PurgeSettings`。
- 如果启用了库级配置：相应库的 `.typora/data/typora-autocaps.json`。
- 不再需要的 `<框架目录>/autocaps-backups/` 备份。
- 如自定义过快捷键，在框架 Hotkeys 中恢复该命令默认设置；不要删除整个框架配置文件。

不再使用宿主框架时，按其 [官方卸载说明](https://github.com/typora-community-plugin/typora-community-plugin/blob/main/docs/en-us/user-guide/1b-uninstall.md) 操作。AutoCaps 卸载器不会卸载其他插件或还原 Typora 的 HTML。

## 边界与已知问题

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

产物：`dist/plugin.zip`、`dist/typora-autocaps-0.1.0-windows.zip`、`dist/typora-autocaps-0.1.0-source.zip`、`dist/SHA256SUMS.txt`。核心 `main.js` 为 **15,270 字节（14.91 KiB）**，无运行时 npm 依赖；开发测试仅直接依赖 `jsdom`，宿主框架单独安装。

可复现的真实编辑器集成测试说明位于源码包 `tools/native-probe/README.md`，准备脚本只创建隔离的程序副本和新配置目录。

GitHub Actions 在推送与 PR 上测试，在推送版本标签（如 `0.1.0`）时生成 **Draft Release**，供维护者实机验收后发布。仓库所属 GitHub 账号未指定，因此 manifest 未填写虚构的 `repo` / `authorUrl`；发布及市场登记的最后步骤见 [RELEASING.md](docs/RELEASING.md)。

## 反馈

在你下载本插件的 GitHub 仓库打开 **Issues → Bug report**，提供 Typora/框架/插件版本、系统、输入法、最小复现步骤以及是否处于公式或代码区域。使用脱敏样例，不要附带私人笔记。对于输入异常，先关闭 AutoCaps 再继续编辑。

MIT License。
