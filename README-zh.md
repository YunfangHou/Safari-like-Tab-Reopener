# 用 Command-Z / Ctrl-Z 重新打开关闭的标签页

\[ 简体中文 | [English](./README.md) \]

这是一个浏览器扩展，旨在在其他浏览器上（比如 Firefox、Google Chrome 和 Microsoft Edge）复现 Safari 的一个符合直觉的快捷键。

## 功能

像 Safari 一样使用 `Command + Z`  重新打开标签页（或在 Windows 上使用 `Ctrl + Z`)。

在文本编辑区域内时，不会与「撤销」功能冲突，即智能选择执行「撤销」，而非「重新打开标签页」。

特别为从 Safari 转移过来并已经习惯了 Safari 的直观性的用户开发。我们也推荐所有用户体验这一符合直觉的快捷键！

## 兼容性

为所有操作系统开发。已在 macOS（Command + Z）和 Windows（Ctrl + Z）上进行了测试。

为 Firefox 和所有使用 Chromium 的浏览器开发。已在 Firefox、Google Chrome 和 Microsoft Edge 上进行了测试。

请随时在 Issues 上报告错误或提供建议。

## 安装

### Firefox

在 [Firefox 附加组件商店](https://addons.mozilla.org/firefox/addon/reopen-closed-tab-with-cmd-z/)安装，或使用[此包](./package%20for%20Firefox)手动安装。

### Google Chrome 和 Microsoft Edge

Google 要求开发者支付 5 美元才能将其扩展程序上传到 Chrome 网上应用商店 🥲 所以请手动安装：

1. 下载[此包](./package%20for%20Chromium)
2. 导航到 `chrome://extensions/` 或 `edge://extensions/`
3. 开启`开发者模式`
4. 点击`加载已解压的扩展程序`
5. 上传第 1 步中下载的文件夹

### 其他使用 Chromium 的浏览器

请搜索如何在您的浏览器上手动安装扩展的相关信息。当您需要上传扩展文件时，使用[此包](./package%20for%20Chromium)。

## 已知错误
- 编辑 GitHub 代码时无效
