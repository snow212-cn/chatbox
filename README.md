<p align="right">
  <a href="README.md">English</a> |
  <a href="./doc/README-CN.md">简体中文</a>
</p>

<h1 align="center">
<img src='./doc/statics/icon.png' width='30' alt="Chatbox icon" />
<span>Chatbox Fork</span>
</h1>

<p align="center">
  <em>An independently maintained fork of Chatbox for desktop use.</em>
</p>

<p align="center">
<a href="https://github.com/snow212-cn/chatbox/releases" target="_blank">
<img alt="Releases" src="https://img.shields.io/github/v/release/snow212-cn/chatbox?display_name=tag&style=flat-square" />
</a>
<a href="https://github.com/snow212-cn/chatbox/releases" target="_blank">
<img alt="Downloads" src="https://img.shields.io/github/downloads/snow212-cn/chatbox/total?style=flat-square" />
</a>
<a href="https://github.com/snow212-cn/chatbox/issues" target="_blank">
<img alt="Issues" src="https://img.shields.io/github/issues/snow212-cn/chatbox?style=flat-square" />
</a>
<a href="https://github.com/snow212-cn/chatbox/blob/patch/LICENSE" target="_blank">
<img alt="License" src="https://img.shields.io/github/license/snow212-cn/chatbox?style=flat-square" />
</a>
</p>

This repository is an independently maintained enhanced fork of [chatboxai/chatbox](https://github.com/chatboxai/chatbox), released under the GPLv3 license.

The fork keeps upstream compatibility where practical, but it is maintained on its own release cadence and includes fork-specific fixes and packaging changes. The `main` branch is used to track upstream syncs, and the `patch` branch is the branch used for fork releases.

## Downloads

Desktop builds published by this fork are available from:

- [GitHub Releases](https://github.com/snow212-cn/chatbox/releases)

At the moment, this fork primarily publishes desktop artifacts. Mobile store listings and the original website are not used as the distribution channel for this fork.

<a href="./doc/statics/snapshot_light.png">
<img src="./doc/statics/snapshot_light.png" width="400" alt="Light screenshot" />
</a>
<a href="./doc/statics/snapshot_dark.png">
<img src="./doc/statics/snapshot_dark.png" width="400" alt="Dark screenshot" />
</a>

## What This Fork Focuses On

- Strengthening the conversation forking experience
- Desktop-first packaging and release automation
- Keeping local data on device
- Support for multiple providers and local-model backends
- Fork-specific fixes that may not land upstream
- Periodic upstream syncs when they are still compatible with this fork

## Fork-Specific Changes

Compared with upstream, this fork currently includes these maintenance-focused changes:

- A stronger conversation forking workflow focused on preserving original branches after rewriting a message
- Improvements aimed at the problem described in [issue #2510](https://github.com/chatboxai/chatbox/issues/2510): keeping the original branch visible after conversation rewrite and making branch-based conversation flow more reliable
- More robust session and fork-branch recovery logic to reduce blank or missing chats after restart
- Recovery tooling for extracting session data from IndexedDB when local state needs repair
- Shared user-data path handling so existing Chatbox data can be reused more safely by this fork
- Better handling of local file links on desktop, including Windows paths and `file://` links in Markdown
- Local packaging adjustments so unsigned desktop builds can be produced more reliably in this fork
- GitHub Actions automation for upstream sync, patch-branch release flow, and release asset publishing

## Why This Fork Exists

This fork exists to continue shipping fixes and enhancements that were important to its maintainer but were not practical to land upstream through the current collaboration model.

In particular, the conversation-branching problem raised in [issue #2510](https://github.com/chatboxai/chatbox/issues/2510) became a primary motivation: this fork treats branch preservation and a stronger multi-branch conversation experience as product-level priorities rather than waiting for upstream acceptance.

## Features

- Local data storage
- Desktop installers for Windows, macOS, and Linux
- Support for multiple LLM providers, including OpenAI, Azure OpenAI, Claude, Gemini, Ollama, and compatible APIs
- Prompt library and message quoting
- Markdown, LaTeX, and code highlighting
- Streaming replies
- Keyboard shortcuts
- Dark theme and cross-platform desktop UI
- Team-sharing related code and docs retained in the repository

## FAQ

- [Frequently Asked Questions](./doc/FAQ.md)

## Contributing

Issues and focused bug reports are welcome.

If you want to propose a larger change, open an issue first so the maintenance direction stays clear. This fork is maintained with a patch-based workflow, so not every pull request will be accepted.

## Prerequisites

- Node.js `>=20 <25`
- pnpm `>=10`

## Build Instructions

1. Clone this fork

```bash
git clone https://github.com/snow212-cn/chatbox.git
cd chatbox
```

2. Install dependencies

```bash
pnpm install
```

3. Start the app in development mode

```bash
pnpm run dev
```

4. Build and package for the current platform

```bash
pnpm run package
```

5. Build and package for all supported desktop platforms

```bash
pnpm run package:all
```

## Branches

- `main`: upstream-tracking branch
- `patch`: fork release branch

## Upstream Relationship

This project remains a fork of the upstream Chatbox repository, but it is maintained independently. Upstream updates may be merged when they fit the fork, while fork-specific changes are released from `patch`.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=snow212-cn/chatbox&type=Date)](https://star-history.com/#snow212-cn/chatbox&Date)
