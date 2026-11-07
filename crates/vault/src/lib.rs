//! Syncvault vault — key handling for the desktop app (napi-rs native addon).
//!
//! SKELETON ONLY. The app does not load this crate yet.
//!
//! Planned responsibilities (see README.md):
//! - Derive keys from the master password with Argon2id.
//! - Keep keys only in memory (zeroized on drop); never write them to disk.
//! - Wrap/unwrap the vault key and store the wrapped key in the OS keychain.
//! - Provide the rclone config password at runtime.

#![deny(clippy::all)]

use napi_derive::napi;

/// Placeholder export proving the napi-rs wiring. Returns the crate version.
#[napi]
pub fn vault_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_set() {
        assert!(!vault_version().is_empty());
    }
}
