import { useRouter } from 'next/router';
import Head from 'next/head';
import { absolutePublicAsset } from '@lib/assets';
import { siteURL } from '@lib/env';

import type { JSX } from 'react';

type MainLayoutProps = {
  title: string;
  image?: string;
  description?: string;
};

export const DEFAULT_SEO_IMAGE = '/assets/twitter-banner.png';

export function SEO({
  title,
  image = DEFAULT_SEO_IMAGE,
  description
}: MainLayoutProps): JSX.Element {
  const { asPath } = useRouter();
  const absoluteImage = absolutePublicAsset(image);

  return (
    <Head>
      <title>{title}</title>
      <meta property='og:title' content={title} key='og:title' />
      <meta name='twitter:title' content={title} key='twitter:title' />
      {description && <meta name='description' content={description} />}
      {description && (
        <meta
          property='og:description'
          content={description}
          key='og:description'
        />
      )}
      {description && (
        <meta
          name='twitter:description'
          content={description}
          key='twitter:description'
        />
      )}
      <meta property='og:image' content={absoluteImage} key='og:image' />
      <meta name='twitter:image' content={absoluteImage} key='twitter:image' />
      <meta
        property='og:url'
        content={`${siteURL}${asPath === '/' ? '' : asPath}`}
        key='og:url'
      />
    </Head>
  );
}
