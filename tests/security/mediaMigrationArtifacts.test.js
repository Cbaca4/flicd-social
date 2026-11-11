import { describe,it,expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parseAddedMigrationPatch,verifyMigrationArtifacts } from '../../scripts/verify-media-migration-artifacts.mjs';
import { MEDIA_REVIEW_MIGRATIONS } from '../../scripts/verify-local-media-security.mjs';
describe('security migration publication artifacts',()=>{
 it('matches all four preserved payloads and the separate forward migration in dependency order',async()=>{
  const results=await verifyMigrationArtifacts();
  expect(results.map(row=>row.path)).toEqual(MEDIA_REVIEW_MIGRATIONS.map(name=>'supabase/migrations/'+name));
  expect(results).toHaveLength(5);
 });
 const patch='diff --git a/x.sql b/x.sql\nnew file mode 100644\n--- /dev/null\n+++ b/x.sql\n@@ -0,0 +1,1 @@\n+select 1;\n';
 it('rejects truncated payload line counts',()=>expect(()=>parseAddedMigrationPatch(patch.replace('+1,1','+1,2'))).toThrow('line count'));
 it('rejects mismatched header paths',()=>expect(()=>parseAddedMigrationPatch(patch.replace('a/x.sql','a/other.sql'))).toThrow('patch path'));
 it('rejects hidden deletion/context hunks',()=>expect(()=>parseAddedMigrationPatch(patch.replace('+select 1;','-select 1;'))).toThrow('Unexpected removed'));
 it('keeps every SQL/HTTP authorization suite and the artifact guard in CI without bypass flags',async()=>{
  const ci=await readFile('.github/workflows/security-integration.yml','utf8');
  for(const name of ['media-security','keeps','keep-library','media-edge-cases','media-blocking','media-boundaries','media-upgrade','media-http'])expect(ci).toContain('run: node scripts/verify-local-'+name+'.mjs');
  expect(ci).toContain('run: node scripts/verify-media-migration-artifacts.mjs');
  expect(ci).not.toMatch(/--without|--before-remediation|continue-on-error/);
 });
});
