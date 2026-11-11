// Read-only publication guard. No database or environment-file access.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { MEDIA_REVIEW_MIGRATIONS } from './verify-local-media-security.mjs';
const normalize=text=>text.replaceAll('\r\n','\n');
export function parseAddedMigrationPatch(text){
 const entries=[];
 for(const section of normalize(text).split(/(?=^diff --git )/m).filter(Boolean)){
  const lines=section.trimEnd().split('\n');
  const match=/^diff --git a\/(\S+) b\/(\S+)$/.exec(lines[0]);
  assert.ok(match&&match[1]===match[2],'Unexpected patch path');
  assert.ok(lines.includes('new file mode 100644')&&lines.includes('--- /dev/null'),'Only added migration payloads are permitted');
  const index=lines.findIndex(line=>line.startsWith('@@ '));
  const hunk=/^@@ -0,0 \+1,(\d+) @@$/.exec(lines[index]||'');
  assert.ok(hunk,'Expected one complete new-file hunk');
  const payload=lines.slice(index+1);
  assert.ok(payload.every(line=>line.startsWith('+')),'Unexpected removed/context/hunk line');
  assert.equal(payload.length,Number(hunk[1]),'Declared patch line count differs');
  entries.push({path:match[1],content:payload.map(line=>line.slice(1)).join('\n')+'\n'});
 }
 return entries;
}
export async function verifyMigrationArtifacts(root=process.cwd()){
 const artifacts=[['docs/evidence/privacy-boards-migration-drafts-20261020.patch',MEDIA_REVIEW_MIGRATIONS.slice(0,4)],['docs/evidence/privacy-blocker-remediation-forward-20261021.patch',MEDIA_REVIEW_MIGRATIONS.slice(4)]];
 assert.deepEqual([...MEDIA_REVIEW_MIGRATIONS].sort(),MEDIA_REVIEW_MIGRATIONS,'Migration dependency order changed');
 const results=[];
 for(const [artifact,expected] of artifacts){
  const entries=parseAddedMigrationPatch(await readFile(resolve(root,artifact),'utf8'));
  assert.deepEqual(entries.map(entry=>entry.path),expected.map(name=>'supabase/migrations/'+name),'Missing/reordered/extra migration payload');
  for(const entry of entries){
   const source=await readFile(resolve(root,entry.path),'utf8');
   assert.equal(entry.content,normalize(source),'Patch differs from SQL: '+entry.path);
   results.push({artifact,path:entry.path,sha256:createHash('sha256').update(source).digest('hex')});
  }
 }
 return results;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 verifyMigrationArtifacts().then(results=>console.log(JSON.stringify({checks:results.length,results},null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
