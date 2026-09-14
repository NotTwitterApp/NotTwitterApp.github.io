import { Html, Head, Main, NextScript } from 'next/document';

import type { JSX } from 'react';

export default function Document(): JSX.Element {
  return (
    <Html lang='en'>
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
