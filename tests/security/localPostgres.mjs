// Local PostgreSQL only. No hosted endpoint or credential-file discovery.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const run = promisify(execFile);
export async function createLocalDatabase() {
  const binary = process.env.FLICD_LOCAL_PSQL;
  if (!binary) throw new Error('Set FLICD_LOCAL_PSQL to an approved local psql binary.');
  const port = String(process.env.FLICD_LOCAL_PG_PORT || '55439');
  if (!/^\d{4,5}$/.test(port)) throw new Error('Invalid local PostgreSQL port.');
  const database = 'flicd_local_' + randomUUID().replaceAll('-', '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^PG/i.test(name)));
  env.PGPASSFILE = resolve(process.env.TMPDIR || '.', 'flicd-no-password-file');
  const args = ['-X', '-w', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-A', '-t'];
  const sql = async (statement, db = database) => {
    try { return (await run(binary, [...args, '-d', db, '-c', statement], { env, maxBuffer: 4*1024*1024 })).stdout.trim(); }
    catch (error) { throw new Error(error.stderr?.trim() || 'Local SQL failed.'); }
  };
  await sql(`CREATE DATABASE ${database}`, 'postgres');
  const file = async (path) => {
    await readFile(resolve(path), 'utf8');
    try { return (await run(binary, [...args, '-d', database, '-f', resolve(path)], { env, maxBuffer: 4*1024*1024 })).stdout.trim(); }
    catch (error) { throw new Error(error.stderr?.trim() || 'Local SQL file failed.'); }
  };
  const rpc = async (name, payload, role = 'service_role') => {
    if (!/^media_[a-z_]+$/.test(name) || !['service_role', 'authenticated', 'anon'].includes(role)) throw new Error('Unsafe local RPC identifier.');
    const literal = JSON.stringify(payload).replaceAll("'", "''");
    const result = await sql(`SET ROLE ${role}; SELECT public.${name}('${literal}'::jsonb);`);
    return JSON.parse(result.split(/\r?\n/).at(-1));
  };
  return { sql, file, rpc, database, close: () => sql(`DROP DATABASE ${database} WITH (FORCE)`, 'postgres') };
}
