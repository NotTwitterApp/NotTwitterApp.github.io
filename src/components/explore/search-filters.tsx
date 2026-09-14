import Link from 'next/link';
import { useRouter } from 'next/router';
import cn from 'clsx';
import { HeroIcon } from '@components/ui/hero-icon';
import type { ParsedUrlQueryInput } from 'querystring';

type FilterOption = {
  label: string;
  active: boolean;
  query: ParsedUrlQueryInput;
};

function getRouteParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function cleanQuery(query: ParsedUrlQueryInput): ParsedUrlQueryInput {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined)
  );
}

function FilterLink({ label, active, query }: FilterOption): JSX.Element {
  return (
    <Link href={{ pathname: '/explore', query: cleanQuery(query) }} shallow>
      <a
        className={cn(
          'accent-tab flex items-center justify-between rounded-md py-1 text-[15px]',
          active
            ? 'font-bold text-light-primary dark:text-dark-primary'
            : 'text-light-secondary dark:text-dark-secondary'
        )}
      >
        <span>{label}</span>
        {active && (
          <HeroIcon
            solid
            className='h-5 w-5 text-main-accent'
            iconName='CheckIcon'
          />
        )}
      </a>
    </Link>
  );
}

export function SearchFilters(): JSX.Element | null {
  const { query } = useRouter();
  const searchQuery = getRouteParam(query.q).trim();

  if (!searchQuery) return null;

  const baseQuery = {
    q: searchQuery,
    src: getRouteParam(query.src) || 'typed_query',
    f: getRouteParam(query.f) || undefined
  };
  const peopleFollowed = query.pf === 'on';
  const locationNear = query.lf === 'on';

  return (
    <section className='hover-animation rounded-2xl bg-main-sidebar-background px-4 py-3'>
      <h2 className='text-xl font-extrabold'>Search filters</h2>
      <div className='mt-3 border-b border-light-border pb-3 dark:border-dark-border'>
        <h3 className='mb-2 font-bold'>People</h3>
        <div className='flex flex-col gap-2'>
          <FilterLink
            label='From anyone'
            active={!peopleFollowed}
            query={{ ...baseQuery, lf: locationNear ? 'on' : undefined }}
          />
          <FilterLink
            label='People you follow'
            active={peopleFollowed}
            query={{
              ...baseQuery,
              pf: 'on',
              lf: locationNear ? 'on' : undefined
            }}
          />
        </div>
      </div>
      <div className='mt-3 pb-1'>
        <h3 className='mb-2 font-bold'>Location</h3>
        <div className='flex flex-col gap-2'>
          <FilterLink
            label='Anywhere'
            active={!locationNear}
            query={{ ...baseQuery, pf: peopleFollowed ? 'on' : undefined }}
          />
          <FilterLink
            label='Near you'
            active={locationNear}
            query={{
              ...baseQuery,
              pf: peopleFollowed ? 'on' : undefined,
              lf: 'on'
            }}
          />
        </div>
      </div>
      <a
        className='custom-underline mt-3 block text-main-accent'
        href='https://twitter.com/search-advanced'
        target='_blank'
        rel='noreferrer'
      >
        Advanced search
      </a>
    </section>
  );
}
