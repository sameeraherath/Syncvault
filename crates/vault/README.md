# crates/vault

Rust native addon ([napi-rs](https://napi.rs)) that will own all key material for Syncvault.

**Status: skeleton.** It exports one placeholder function (`vaultVersion()`). The desktop app does
**not** depend on it yet, so `pnpm dev` works without a Rust toolchain.

## Why Rust?

Key handling needs memory we control: zeroize-on-drop buffers, no garbage-collector copies of secrets,
and direct access to the OS keychains. It is small, auditable, and isolated from the JS code.

## Planned API

| Function                            | Purpose                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `deriveKey(password, salt, params)` | Argon2id key derivation (memory-hard, parameters stored with the vault)             |
| `unlock(password)` / `lock()`       | Unwrap the vault key into memory / wipe it                                          |
| `createRecoveryKey()`               | Generate a recovery key that can also unwrap the vault key                          |
| `rcloneConfigPassword()`            | Return the rclone.conf password for the child env (never written to disk)           |
| `keychainStore/Load/Delete`         | OS keychain: Secret Service (Linux), Credential Manager (Windows), Keychain (macOS) |

Rules: proven crypto only (Argon2id, rclone crypt). Keys and the master password live only in memory.
The wrapped key is stored only in the OS keychain.

## Build

```bash
cargo check            # from this directory
cargo test
```

TODO: add `package.json` + `@napi-rs/cli` build to produce `vault.<platform>.node`, and load it from
Electron main / the core once implemented.
