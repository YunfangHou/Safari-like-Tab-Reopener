# 以 Safari 的风格重新打开标签页

\[ 简体中文 | [English](./README.md) \]

这是一个浏览器扩展，旨在在其他浏览器上（比如 Firefox、Google Chrome 和 Microsoft Edge）复现 Safari 的一个符合直觉的快捷键。

## 功能

像 Safari 一样使用 `Command + Z`  重新打开标签页（或在 Windows 上使用 `Ctrl + Z`)。

快捷键可跨键盘布局识别 Z 键，包括该键会产生其他字符的布局，例如俄语布局中的 `я`。

在文本编辑区域内或使用 Google 表格时，不会与「撤销」功能冲突，即智能选择执行「撤销」，而非「重新打开标签页」。

对于在线图片编辑器、网站构建工具等拥有自身撤销快捷键的网站，可将其加入排除列表。左键单击扩展按钮可快速添加当前网站或管理列表；也可右键单击并选择 **Excluded websites** 打开完整编辑页面。每条域名规则也会排除其子域名。

特别为从 Safari 转移过来并已经习惯了 Safari 的直观性的用户开发。我们也推荐所有用户体验这一符合直觉的快捷键！

## 兼容性

为所有操作系统开发。已在 macOS（Command + Z）和 Windows（Ctrl + Z）上进行了测试。

为 Firefox 和所有使用 Chromium 的浏览器开发。已在 Firefox、Google Chrome 和 Microsoft Edge 上进行了测试。

请随时在 Issues 上报告错误或提供建议。

## 安装

### Firefox

在 [Firefox 附加组件商店](https://addons.mozilla.org/firefox/addon/safari-like-tab-reopener/)安装，或使用[此包](./package%20for%20Firefox)手动安装。

### Google Chrome

在 [Google Chrome 扩展商店](https://chromewebstore.google.com/detail/reopen-closed-tab-with-co/lhdlapjgijgdpoobgjlbnnijoepcbodf)安装，或使用[此包](./package%20for%20Chromium)手动安装。


### Microsoft Edge 或其他使用 Chromium 的浏览器

请搜索如何在您的浏览器上手动安装扩展的相关信息。当您需要上传扩展文件时，使用[此包](./package%20for%20Chromium)。
