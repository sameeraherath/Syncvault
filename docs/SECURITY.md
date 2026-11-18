# Security

## Reporting a vulnerability

Please **do not** open a public issue. Email **security@getsyncvault.com** _(placeholder — address not yet
active)_ with a description, reproduction steps and affected version. We aim to acknowledge within 7 days.
GitHub private vulnerability reporting will be enabled once the repository is public.

## Threat model

### What Syncvault protects against

- **Cloud providers reading your files.** Files are encrypted on your device with rclone crypt before upload;
  file names can be encrypted too. Providers only store ciphertext.
- **Network attackers.** All provider traffic uses TLS; content is additionally encrypted end-to-end.
- **Other local users on the same machine** reaching the app's internals: the core socket lives in a `0700`
  directory with a `0600` socket and requires a per-start random token; rclone's rc API listens on
  `127.0.0.1` only with a random port and random credentials passed via environment variables (not argv).
- **Leaking secrets to disk.** Master password and keys stay in memory. The only key material on disk is the
  vault key wrapped with AES-256-GCM under an Argon2id key from the master password (`vault.json`), and
  rclone.conf encrypted with a key derived from the vault key.
- **Offline guessing of the master password** from a copied `vault.json` is slowed by Argon2id (64 MiB, t=2).
  A long master password (or passphrase) is still what really protects it.

### What Syncvault does NOT protect against

- **Malware running as your user on an unlocked machine.** It can read your files before encryption and
  read process memory.
- **A stolen, unlocked laptop.** Local files are plain files. Use full-disk encryption (LUKS on Linux,
  BitLocker, FileVault) and lock your screen.
- **A forgotten master password without the recovery key.** Zero-knowledge means we cannot recover your data.
- **Someone who has your recovery key.** It is the root secret: with it, all keys can be rebuilt. Keep it offline.

## Security rules for contributors

The non-negotiable rules are listed in [CLAUDE.md](../CLAUDE.md#security-rules-non-negotiable). Highlights:

- Electron hardening: `contextIsolation`, `sandbox`, no `nodeIntegration`, strict CSP in production,
  no remote content, navigation and new windows blocked.
- Never log secrets, tokens, passwords, keys, or full user-content paths at info level.
- rclone.conf must always be encrypted with rclone config encryption; the password comes from the vault at
  runtime and is never written to disk in plain text.
- No telemetry or analytics. Network calls only to the user's chosen providers and the update server.
- Proven crypto only (rclone crypt, Argon2id).

## Known gaps in the current scaffold

- **Secrets in JS strings can't be wiped.** The vault key lives in a `Buffer` that is zeroed on lock, but the
  master password and recovery key pass through JS strings (renderer → main → core), which stay in memory until
  garbage-collected. The Rust vault crate (zeroized memory) is meant to fix this.
- No OS keychain integration yet (no "unlock automatically"); no auto-lock on idle.
- The GPG signature of rclone's `SHA256SUMS` is not verified yet (SHA256 of each archive is).
- Stale-rclone cleanup after a hard crash only verifies the process on Linux.
