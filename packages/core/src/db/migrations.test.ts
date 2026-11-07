import { describe, expect, it } from 'vitest';
import { latestSchemaVersion, migrations, pendingMigrations } from './migrations.js';

describe('migrations', () => {
  it('have strictly increasing versions starting at 1', () => {
    migrations.forEach((m, i) => expect(m.version).toBe(i + 1));
  });

  it('computes pending migrations', () => {
    expect(pendingMigrations(0)).toHaveLength(migrations.length);
    expect(pendingMigrations(latestSchemaVersion())).toHaveLength(0);
  });
});
