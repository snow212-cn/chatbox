<p align="right">
  <a href="../README.md">English</a> |
  <a href="README-CN.md">简体中文</a>
</p>

<h1 align="center">
<img src='./statics/icon.png' width='30' alt="Chatbox icon" />
<span>Chatbox Fork</span>
</h1>

<p align="center">
  <em>一个以桌面端使用为重点、独立维护的 Chatbox 强化修改版分支。</em>
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

这个仓库是 [chatboxai/chatbox](https://github.com/chatboxai/chatbox) 的独立维护强化修改版 fork，继续以 GPLv3 许可证发布。

这个 fork 会在合适的时候同步上游，但按自己的节奏维护和发布，也包括仅在本 fork 中维护的修复与打包调整。仓库中的 `main` 分支用于跟踪上游同步，`patch` 分支用于承载 fork 的发布内容。

## 下载

本 fork 发布的桌面端构建产物统一放在：

- [GitHub Releases](https://github.com/snow212-cn/chatbox/releases)

目前这个 fork 主要发布桌面端安装包，不再把原项目官网和移动端商店页面作为分发入口。

<img src="./statics/demo_desktop_1.jpg" alt="应用截图" style="box-shadow: 2px 2px 10px rgba(0,0,0,0.1); border: 1px solid #ddd; border-radius: 8px; width: 700px" />

<img src="./statics/demo_desktop_2.jpg" alt="应用截图" style="box-shadow: 2px 2px 10px rgba(0,0,0,0.1); border: 1px solid #ddd; border-radius: 8px; width: 700px" />

## 这个 Fork 的重点

- 强化对话分叉体验
- 以桌面端打包和发布为主
- 保持数据尽量存放在本地设备
- 保留多模型提供商与本地模型后端支持
- 持续维护上游未必会接收的 fork 专属修复
- 在兼容前提下周期性同步上游更新

## Fork 中新增或强化的修改

相对上游版本，这个 fork 当前增加或强化了以下内容：

- 重点强化了对话分叉工作流，尤其是“改写消息后保留原分支”的使用体验
- 对 [issue #2510](https://github.com/chatboxai/chatbox/issues/2510) 提出的问题进行了改进：尽量在复写对话后保留原始分支，并提升多分支对话流转的可靠性
- 改进会话与分叉分支恢复逻辑，尽量减少重启后聊天记录空白或丢失的问题
- 提供基于 IndexedDB 的会话恢复脚本，方便在本地状态异常时排查和恢复数据
- 增加面向本 fork 的本地打包配置，使未签名桌面构建和本地发布流程更稳定
- 增加 GitHub Actions 自动化流程，用于同步上游、合并到 `patch` 并发布 release

## 为什么会有这个 Fork

这个 fork 的动机是推进一些用户认为重要、但不适合继续等待上游作者的修复和增强。上游作者不接受以外部 Pull Request 协作为核心的开源维护模式，因此这个 fork 选择独立维护，把关键改动落地并持续发布。

其中核心的一点是把 [issue #2510](https://github.com/chatboxai/chatbox/issues/2510) 所反映的对话分叉问题为重点来处理。这个 fork 将“保留原始对话分支”和“增强多分支对话体验”视为明确的产品目标，据此持续维护。

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
