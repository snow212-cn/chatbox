<p align="right">
  <a href="../README.md">English</a> |
  <a href="README-CN.md">简体中文</a>
</p>

<h1 align="center">
<img src='./statics/icon.png' width='30' alt="Chatbox icon" />
<span>Chatbox Fork</span>
</h1>

<p align="center">
  <em>一个独立维护的 Chatbox 增强修改版分支，目标是在从历史消息改写继续时保留原始对话分支。</em>
</p>

<p align="center">
<a href="https://github.com/snow212-cn/chatbox/releases" target="_blank">
<img alt="Releases" src="https://img.shields.io/github/v/release/snow212-cn/chatbox?display_name=tag&style=flat-square" />
</a>
<a href="https://github.com/snow212-cn/chatbox/releases" target="_blank">
<img alt="下载量" src="https://img.shields.io/github/downloads/snow212-cn/chatbox/total?style=flat-square" />
</a>
<a href="https://github.com/snow212-cn/chatbox/issues" target="_blank">
<img alt="Issues" src="https://img.shields.io/github/issues/snow212-cn/chatbox?style=flat-square" />
</a>
<a href="https://github.com/snow212-cn/chatbox/blob/patch/LICENSE" target="_blank">
<img alt="License" src="https://img.shields.io/github/license/snow212-cn/chatbox?style=flat-square" />
</a>
</p>

这个仓库是 [chatboxai/chatbox](https://github.com/chatboxai/chatbox) 的独立维护增强修改版 fork，继续以 GPLv3 许可证发布。

这个 fork 会在合适的时候同步上游，但按自己的节奏维护和发布，也包括仅在本 fork 中维护的修复与打包调整。仓库中的 `main` 分支用于跟踪上游同步，`patch` 分支用于承载 fork 的发布内容。

## 下载

发布的桌面端构建产物统一放在：

- [GitHub Releases](https://github.com/snow212-cn/chatbox/releases)

目前这个 fork 主要发布桌面端安装包，不再把原项目官网和移动端商店页面作为分发入口。

<img src="./statics/demo_desktop_1.jpg" alt="应用截图" style="box-shadow: 2px 2px 10px rgba(0,0,0,0.1); border: 1px solid #ddd; border-radius: 8px; width: 700px" />

<img src="./statics/demo_desktop_2.jpg" alt="应用截图" style="box-shadow: 2px 2px 10px rgba(0,0,0,0.1); border: 1px solid #ddd; border-radius: 8px; width: 700px" />

## Fork 中新增或强化的修改

这个 fork 最重要的修改就是强化 Chatbox 的多分叉对话能力。

[issue #2510](https://github.com/chatboxai/chatbox/issues/2510) 暴露出的问题明确：当用户回到较早的消息重新改写并继续对话时，原来的对话路径不应该被覆盖、移除或变得无法返回，而应该被保留下来，并且能够继续在不同分支之间切换。这个 fork 围绕多分叉对话的问题进行修复和改进。

fork 要实现的核心体验：

- 从历史消息重新改写并继续对话时，原始对话分支仍然保留
- 原始分支和新分支之间更容易识别、切换和继续
- 重启应用或恢复会话后，分叉状态尽量不会变成空白、错乱或丢失
- 增加 GitHub Actions 自动化流程，用于同步上游、合并到 `patch` 并发布 release

fork 中的其他工程改动，基本都是为了支撑这些修改并修复它带来的副作用，而不是这次 fork 的重点。

## 为什么会有这个 Fork

Fork 的动机是推进一些用户认为重要、但不适合继续等待上游作者的修复和增强。原作者长期不接受以外部 Pull Request 合作的维护模式，开源协作态度消极，因此这个 fork 选择独立维护，把“保留原始对话分支”和“增强多分支对话体验”视为明确的产品方向，并在保留上游同步能力的前提下持续维护。

## 功能

- 本地数据存储
- Windows、macOS、Linux 桌面安装包
- 支持多个 LLM 提供商，包括 OpenAI、Azure OpenAI、Claude、Gemini、Ollama 及兼容 API
- 提示词库与消息引用
- Markdown、LaTeX 与代码高亮
- 流式回复
- 键盘快捷键
- 深色主题与跨平台桌面界面
- 仓库中仍保留 team-sharing 相关代码与文档

## 常见问题解答

- [常见问题](./FAQ-CN.md)

## 贡献

欢迎提交 issue 和聚焦明确的 bug 报告。如果要提交较大的修改，建议先开 issue 讨论方向。这个 fork 采用基于 `patch` 的维护流程。

## 环境要求

- Node.js `>=20 <25`
- pnpm `>=10`

## 构建指南

1. 克隆本 fork

```bash
git clone https://github.com/snow212-cn/chatbox.git
cd chatbox
```

2. 安装依赖

```bash
pnpm install
```

3. 以开发模式启动应用

```bash
pnpm run dev
```

4. 为当前平台构建并打包

```bash
pnpm run package
```

5. 为桌面端支持的平台构建并打包

```bash
pnpm run package:all
```

## 分支说明

- `main`：上游同步分支
- `patch`：fork 发布分支

## 与上游的关系

这个项目仍然保持为上游 Chatbox 仓库的 fork，但已经独立维护。上游更新会在适合本 fork 时再合入，而 fork 自己的修改从 `patch` 分支发布。

## Star History

[![星星历史图表](https://api.star-history.com/svg?repos=snow212-cn/chatbox&type=Date)](https://star-history.com/#snow212-cn/chatbox&Date)
