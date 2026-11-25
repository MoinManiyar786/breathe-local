import { cp, mkdir, rm } from 'node:fs/promises';
import { basename } from 'node:path';

const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('../public/', import.meta.url), output, {
  recursive: true,
  filter: (path) => !basename(path).startsWith('.')
});
console.log('Built BreatheLocal to dist/');