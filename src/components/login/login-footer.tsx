import Link from 'next/link';

import type { JSX } from 'react';

const footerLinks = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Help Center', href: '/help-center' },
  { label: 'Bluesky', href: 'https://bsky.app/' },
  { label: 'Repository', href: 'https://github.com/EricKrouss/not-twitter' }
];

export function LoginFooter(): JSX.Element {
  return (
    <footer
      className='flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-3
                 text-[13px] leading-5 text-main-secondary'
    >
      {footerLinks.map(({ label, href }) =>
        href.startsWith('http') ? (
          <a
            className='custom-underline'
            href={href}
            target='_blank'
            rel='noreferrer'
            key={href}
          >
            {label}
          </a>
        ) : (
          <Link href={href} key={href}>
            <a className='custom-underline'>{label}</a>
          </Link>
        )
      )}
      <span>This is NOT Twitter this is Bluesky</span>
    </footer>
  );
}
