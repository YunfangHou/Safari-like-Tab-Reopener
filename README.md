# Safari-like-Tab-Reopener

\[ English | [简体中文](./README-zh.md) \]

This is a browser extension aimed to reproduce an intuitive Safari shortcut on other browsers, such as Firefox, Google Chrome and Microsoft Edge.

## Features

Safari-like function to reopen tab with `Command + Z`, or `Ctrl + Z` on Windows.

The shortcut follows the Z key across keyboard layouts, including layouts where that key produces another character, such as `я` on Russian layouts.

It will not conflict with the Undo function when you are in a text editing field or working in Google Sheets, i.e., intelligently perform *Undo* instead of *Reopen Tab*.

Editing fields implemented with web components and Shadow DOM are also detected through the keyboard event path.

Websites with their own undo shortcuts, such as image editors and website builders, can be added to an exclusion list. Click the extension button to quickly add the current website or manage the list, or right-click it and choose **Excluded websites** to open the full editor. Each domain also excludes its subdomains.

The extension interface automatically follows the browser language, with English and Simplified Chinese currently available.

Developed especially for the users who transfer from, and have got used to the intuitiveness of Safari. We also recommend all users experience this intuitive shortcut!

## Compatibility

Developed for all operation systems. Have been tested on macOS (Command + Z) and Windows (Ctrl + Z).

Developed for Firefox and all browsers using Chromium. Have been tested on Firefox, Google Chrome and Microsoft Edge.

Please feel free to report bug or give advice on the Issues.

## Installation

### Firefox

Install on [Firefox Add-ons Store](https://addons.mozilla.org/firefox/addon/safari-like-tab-reopener/), or manually install using [this package](./package%20for%20Firefox).

### Google Chrome

Install on [Google Chrome Extensions Store](https://chromewebstore.google.com/detail/reopen-closed-tab-with-co/lhdlapjgijgdpoobgjlbnnijoepcbodf), or manually install using [this package](./package%20for%20Chromium).

### Microsoft Edge or other browsers using Chromium

Please search for related information on how to manually install an extension on your browser. When you need to upload extension file, use [this package](./package%20for%20Chromium).
