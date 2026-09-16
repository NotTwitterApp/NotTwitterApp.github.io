import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OAUTH_SCOPES = [
  'atproto',
  'transition:generic',
  'transition:chat.bsky',
  'account:email?action=manage',
  'identity:handle'
];
const OAUTH_SCOPE = OAUTH_SCOPES.join(' ');

function normalizeSiteUrl(value) {
  if (!value) return '';

  const url = new URL(value.trim());

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  return url.toString().replace(/\/+$/g, '');
}

function getGithubPagesSiteUrl() {
  const repository = process.env.GITHUB_REPOSITORY;
  const owner = process.env.GITHUB_REPOSITORY_OWNER?.toLowerCase();

  if (!repository || !owner) return '';

  const repoName = repository.split('/')[1];

  if (!repoName) return '';
  if (repoName.toLowerCase() === `${owner.toLowerCase()}.github.io`)
    return `https://${owner}.github.io`;

  return `https://${owner}.github.io/${repoName}`;
}

const configuredClientId = process.env.NEXT_PUBLIC_ATPROTO_CLIENT_ID;
const siteUrl = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_URL ??
    getGithubPagesSiteUrl()
);

if (!siteUrl || configuredClientId) process.exit(0);

const metadataUrl = `${siteUrl}/oauth/client-metadata.json`;
const neoFreeBirdMetadataUrl = `${siteUrl}/oauth/neofreebird-client-metadata.json`;
const neoFreeBirdRedirectScheme = new URL(neoFreeBirdMetadataUrl).hostname
  .split('.')
  .reverse()
  .join('.');
const neoFreeBirdRedirectUri = `${neoFreeBirdRedirectScheme}:/not-twitter/oauth/neofreebird-callback`;
const metadata = {
  client_id: metadataUrl,
  client_name: 'Not Twitter',
  client_uri: siteUrl,
  redirect_uris: [`${siteUrl}/`],
  scope: OAUTH_SCOPE,
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
  application_type: 'web',
  dpop_bound_access_tokens: true
};
const neoFreeBirdMetadata = {
  client_id: neoFreeBirdMetadataUrl,
  client_name: 'NeoFreeBird',
  client_uri: siteUrl,
  redirect_uris: [neoFreeBirdRedirectUri],
  scope: OAUTH_SCOPE,
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
  application_type: 'native',
  dpop_bound_access_tokens: true
};
const outDir = path.join(process.cwd(), 'public', 'oauth');
const outFile = path.join(outDir, 'client-metadata.json');
const neoFreeBirdOutFile = path.join(
  outDir,
  'neofreebird-client-metadata.json'
);

await mkdir(outDir, { recursive: true });
await writeFile(outFile, `${JSON.stringify(metadata, null, 2)}\n`);
await writeFile(
  neoFreeBirdOutFile,
  `${JSON.stringify(neoFreeBirdMetadata, null, 2)}\n`
);
