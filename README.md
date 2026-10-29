# claude-session-notify

Know when a Claude Code session finishes or needs you, and get back to it in one click.

![macOS notifications: one session done, another waiting for permission](extension/media/readme/notification.png)

This repository holds two ways to get it, sharing one notifier script (`hooks/claude-notify.mjs`):

- **[Notify for Claude Code](extension/README.md)**, the VS Code extension. Nothing else to
  install; works in local windows and over Remote-SSH or in Dev Containers, with
  **Notify for Claude Code — Bridge** on your Mac. Get it from the
  [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=rayz.claude-session-notify)
  or [Open VSX](https://open-vsx.org/extension/rayz/claude-session-notify).
- **[`claude-notify`](docs/plugin.md)**, a Claude Code plugin with the same notifications, for
  setups without the extension.

Tested on macOS with VS Code and the official Claude Code extension.

## Documentation

- [Using it](docs/using.md): notifications, the session list, pausing, setup
- [Commands and settings](docs/commands-and-settings.md)
- [How it works](docs/how-it-works.md), including remote windows
- [Limits, uninstalling, plans](docs/limits.md)
- [The Claude Code plugin](docs/plugin.md)
- [Releasing](RELEASING.md), for maintainers

## Support the project

Free and open source. Donations are welcome:

| Currency | Network | Address |
| --- | --- | --- |
| USDC | Solana | `uHftUQ48JKELxBTJsrWqG7Cz4jLv2hgkz9G6jHptJFV` |
| USDT | TRON (TRC-20) | `TUq4f7MCFvnQBcECteVp9Wun71hqgLrL63` |
| BTC | Bitcoin | `1DbpWsEA2uxN99jRuy9n2Zi7mYEgbFLVeb` |

![QR codes: USDC on Solana, USDT on TRON (TRC-20), BTC on Bitcoin](extension/media/readme/donate.png)

**Send each currency only on its own network.** Coins sent on any other network — USDT on
Ethereum, say — cannot be recovered.
