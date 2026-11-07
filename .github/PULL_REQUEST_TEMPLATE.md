## What & why

<!-- Short description. Link issues with "Closes #123". -->

## Checklist

- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass
- [ ] Small, focused change; Conventional Commit title (`feat(core): …`)
- [ ] No weakening of security rules (CLAUDE.md → Security rules)
- [ ] No weakening of data-safety rules (docs/DATA-SAFETY.md)
- [ ] Tests added for code that deletes, moves or overwrites files
- [ ] No new dependencies (or discussed in an issue first)
- [ ] UI text in `locales/en.json`; keyboard accessible; ≥ 44 px targets; AA contrast
- [ ] Docs updated if architecture changed
- [ ] No secrets, rclone binaries, databases or user data committed
