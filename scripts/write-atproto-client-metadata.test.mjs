import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const generator = fileURLToPath(
  new URL('./write-atproto-client-metadata.mjs', import.meta.url)
);

for (const siteUrl of [
  'https://erickrouss.github.io/not-twitter',
  'https://nottwitterapp.github.io'
]) {
  test(`native callback matches the client domain at ${siteUrl}`, async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'nfb-oauth-metadata-'));
    try {
      execFileSync(process.execPath, [generator], {
        cwd: directory,
        env: {
          ...process.env,
          NEXT_PUBLIC_SITE_URL: siteUrl,
          NEXT_PUBLIC_ATPROTO_CLIENT_ID: ''
        }
      });
      const metadata = JSON.parse(
        await readFile(
          path.join(directory, 'public/oauth/neofreebird-client-metadata.json'),
          'utf8'
        )
      );
      assert.equal(
        metadata.client_id,
        `${siteUrl}/oauth/neofreebird-client-metadata.json`
      );
      const expectedScheme = new URL(metadata.client_id).hostname
        .split('.')
        .reverse()
        .join('.');
      assert.deepEqual(metadata.redirect_uris, [
        `${expectedScheme}:/not-twitter/oauth/neofreebird-callback`
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
