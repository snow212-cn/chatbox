# Upstream Sync And Release

This repository is structured around two long-lived branches:

- `main`: tracks `chatboxai/chatbox` as closely as possible
- `patch`: carries the fork-specific changes and is the only release branch

The workflow at `.github/workflows/sync-upstream-release.yml` automates that model:

1. fast-forward `main` to `upstream/main` when upstream has new commits
2. merge `main` into `patch`
3. create a fork release only when the upstream repository exposes a new GitHub release or tag that this fork has not mirrored yet

Important details:

- The workflow file must exist on the default branch `main` before `schedule` and `workflow_dispatch` are available in GitHub.
- Releases are created from `patch`, not from `main`.
- The default manual behavior is `build_assets: true` and `draft_release: true`.
- "Upstream build" is not used as a trigger because GitHub does not provide a stable cross-repository build event suitable for this workflow. The practical signal is upstream `release/tag`.
- Windows CI removes the `win.sign` hook from `electron-builder.yml` during the workflow so unsigned artifacts can still be produced.

Repository settings to verify:

- Actions have permission to create and approve pull requests is not required.
- Workflow permissions should allow `Read and write permissions` for `GITHUB_TOKEN`.
- The `patch` branch must already exist on `origin`.

If `main -> patch` produces conflicts, the workflow fails intentionally and waits for a manual conflict resolution on `patch`.
