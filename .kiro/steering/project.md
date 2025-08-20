<!------------------------------------------------------------------------------------
   Add Rules to this file or a short description and have Kiro refine them for you:
------------------------------------------------------------------------------------->

严格执行下面的要求

- 使用中文回复，编写文档

- 技术栈：vite + vue

- 不要主动运行、测试、创建 spec 任务(除非用户有特别说明)

- 优先调用 MCP 工具

- 及时更新相关文档和扩展的版本号

- [Translator API](https://developer.chrome.google.cn/docs/ai/translator-api?hl=zh-cn#get_started)

- 采用流式传输 API

---

- chrome 内置 AI 翻译 API 的用法：

```js
await Translator.availability({ sourceLanguage: 'en', targetLanguage: 'zh' });
// => 检查语言对支持情况

// 创建翻译器
let translator = await Translator.create({ sourceLanguage: 'en', targetLanguage: 'zh' });

// 使用示例
await translator.translate('Where is the next bus stop, please?');
// => 请问下一个巴士站在哪里？

// 使用示例 (流式传输)
let stream = translator.translateStreaming('how are you? what do you want to do?');
for await (let chunk of stream) {
  console.log(chunk);
}
 // => 你好吗? 你想做什么？
```

## 历史记录（倒序）
- 2025-08-20 v1.9.12
  - 全文翻译与统一策略：源=auto 时先用 LanguageDetector 检测；与目标同语种（忽略大小写与地区码）直接回显原文，否则调用 Translator API。
  - 落地：shared/translator.js 统一归一化判定；background/service-worker.js 在 TRANSLATE_TEXT/流式链路做检测与短路；content-script 划词弹窗同语种直返原文。
  - 版本同步：package.json 与 manifest.json 升级至 1.9.12。
  - 校验：回读 translator.js、service-worker.js、content-script.js 未发现语法/引用报错。
- 2025-08-20 v1.9.11
  - 修复划词翻译：源语言为自动检测、目标为中文且选中文本为中文时，弹窗不再被立即关闭（避免选区清空竞态误关）。
  - 事件优化：handleTextSelection 在选区为空时，若存在翻译弹窗则不调用 hideOverlay。
  - 版本同步：package.json 与 manifest.json 升级至 1.9.11。
  - 校验：回读修改文件，未发现语法/引用报错。

