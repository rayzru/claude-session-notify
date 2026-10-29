# Releasing

This repository ships two things with versions of their own: the VS Code extension
*Notify for Claude Code* (`extension/`) and the Claude Code plugin `claude-notify`
(`.claude-plugin/`, `hooks/`, `commands/`). They share the notifier script in `hooks/`.

## The VS Code extension

1. Raise `version` in `extension/package.json` and in `extension/bridge/package.json` — the
   bridge, the remote window's half on the user's Mac, is released with the extension at the
   same version — and add a `## <version>` section at the top of `extension/CHANGELOG.md`;
   the release notes are taken from it.
2. Merge to `main`, then tag and push:

   ```sh
   git tag claude-session-notify@0.3.0
   git push origin claude-session-notify@0.3.0
   ```

3. The *Release* workflow builds on macOS, because the notifying app is compiled with Swift.
   It makes the extension's packages for `darwin-arm64` and `darwin-x64`, both carrying the
   same universal app, and for `linux-x64` and `linux-arm64`, where it runs on the remote side
   of a window; and the bridge's for `darwin-arm64` and `darwin-x64`. It creates the GitHub
   release with all of them attached and publishes them to Open VSX.
4. **VS Code Marketplace:** the same workflow publishes both extensions there too, signed in
   through Microsoft Entra ID — no stored token (set up once, below). Until that is set up, the
   run carries a *Marketplace skipped* warning: download the `.vsix` files from the release,
   then on [the publisher page](https://marketplace.visualstudio.com/manage/publishers/rayz)
   open each extension's **⋯** menu → **Update** and upload its packages.

Before tagging, `cd extension && npm test && npm run package` builds and checks the same
package locally.

## The Claude Code plugin

Raise `version` in `.claude-plugin/plugin.json` and merge to `main`. Users pick it up with

```sh
claude plugin marketplace update rayzru
claude plugin update claude-notify@rayzru
```

## One-time setup

- **VS Code Marketplace:** publisher `rayz`, created at
  [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) with the
  Microsoft account it belongs to. The first version is uploaded there as a new extension.
- **VS Code Marketplace from the workflow.** Microsoft retires global access tokens on
  1 December 2026; the workflow signs in as a managed identity instead.
  1. On [portal.azure.com](https://portal.azure.com) (a free subscription is enough):
     *Managed Identities* → **Create**, e.g. `claude-session-notify-release`. A managed
     identity, not an app registration: an app registration signs in but is refused at publish.
  2. On the identity: *Settings → Federated credentials* → **Add credential**, scenario
     *GitHub Actions deploying Azure resources*, organization `rayzru`, repository
     `claude-session-notify`, entity type **Environment**, name `marketplace`.
  3. Its *Client ID* and *Tenant ID* (Settings → Properties) become repository secrets:
     `gh secret set AZURE_CLIENT_ID`, `gh secret set AZURE_TENANT_ID`.
  4. Run the *Marketplace identity* workflow (`gh workflow run marketplace-identity.yml`). Its
     summary shows the member id — the only id the publisher's Members page accepts.
  5. On [the publisher page](https://marketplace.visualstudio.com/manage/publishers/rayz) →
     **Members** → **Add**: that id, role **Contributor**.
  6. `gh variable set MARKETPLACE_ENTRA --body true`. From the next tag on, the workflow
     publishes to the Marketplace by itself.
- **Open VSX:** an Eclipse account with the GitHub user `rayzru`, the Publisher Agreement
  signed on [open-vsx.org](https://open-vsx.org), and the namespace `rayz` — named after the
  extension's publisher — created and first published with an access token:

  ```sh
  export OVSX_PAT=…   # Settings → Access Tokens on open-vsx.org
  npx ovsx create-namespace rayz
  npx ovsx publish --packagePath claude-session-notify-<version>-darwin-*.vsix
  ```

  Then, on open-vsx.org under *Settings → Trusted Publishers*, trust GitHub Actions for
  `rayzru/claude-session-notify`, workflow `release.yml`, and set the repository variable
  `OPEN_VSX_TRUSTED` to `true` (`gh variable set OPEN_VSX_TRUSTED --body true`). From then on
  the workflow publishes without a stored token, and the access token can be deleted.
  Until then, an `OVSX_PAT` repository secret holding that access token does the same
  (`gh secret set OVSX_PAT`). With neither, the release run carries an *Open VSX skipped*
  warning.
