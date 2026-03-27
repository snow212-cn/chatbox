<p align="right">
  <a href="README.md">English</a> |
  <a href="./doc/README-CN.md">简体中文</a>
</p>

<h1 align="center">
<img src='./doc/statics/icon.png' width='30' alt="Chatbox icon" />
<span>Chatbox Fork</span>
</h1>

<p align="center">
  <em>An enhanced Chatbox fork focused on preserving original conversation branches when rewriting from earlier messages.</em>
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

## Core Enhancement

This fork exists first and foremost to strengthen Chatbox's conversation forking behavior.

The upstream problem discussed in [issue #2510](https://github.com/chatboxai/chatbox/issues/2510) is straightforward: when a user goes back to an earlier message, rewrites it, and continues the conversation, the original path should stay preserved and easy to return to. In upstream, that workflow was not reliable enough. This fork treats that as the main enhancement target rather than a secondary fix.

In this fork, the intended behavior is:

- rewriting from an earlier message should keep the original branch instead of effectively replacing it
- alternate branches should be easier to recognize, switch, and continue
- branch state should survive restart and session restore more reliably

The other technical changes in this fork mostly exist to support that branching enhancement and the side effects it introduces, rather than to define the fork on their own.

## Why This Fork Exists

This fork exists because the original maintainer does not accept pull requests and has shown a passive attitude toward open-source collaboration. Waiting for upstream acceptance was therefore not a practical path for this change.

Instead, this fork takes a direct route: independently maintain an enhanced edition of Chatbox, keep syncing upstream where it still makes sense, and continue shipping the conversation-branching improvements as its primary product direction.

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
