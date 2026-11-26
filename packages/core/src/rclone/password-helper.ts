/**
 * Tiny program rclone runs via `--password-command` while encrypting a new rclone.conf.
 * Prints the password from a child-only env var, so it never appears in argv or on disk.
 * Built to dist/password-helper.mjs and run with ELECTRON_RUN_AS_NODE=1.
 */
const value = process.env['SYNCVAULT_RCLONE_NEW_PASS'];
if (!value) {
  process.stderr.write('password helper: no password provided\n');
  process.exit(1);
}
process.stdout.write(value);
