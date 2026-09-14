import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from '@headlessui/react';
import cn from 'clsx';
import { useTheme } from '@lib/context/theme-context';
import { useLongPress } from '@lib/hooks/useLongPress';
import { useModal } from '@lib/hooks/useModal';
import { Modal } from '@components/modal/modal';
import { DisplayModal } from '@components/modal/display-modal';
import { HeroIcon } from '@components/ui/hero-icon';
import { CustomIcon } from '@components/ui/custom-icon';
import { Button } from '@components/ui/button';
import { isNavLinkActive } from './nav-links';
import { MenuLink } from './menu-link';
import type { Variants } from 'framer-motion';

import type { JSX } from 'react';

export const variants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.15, ease: 'easeOut' }
  },
  exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeOut' } }
};

export function MoreSettings(): JSX.Element {
  const { asPath } = useRouter();
  const { theme, toggleColorScheme } = useTheme();
  const { open, openModal, closeModal } = useModal();
  const themeShortcutHandlers = useLongPress({
    onLongPress: openModal,
    onPress: toggleColorScheme
  });
  const themeShortcutLabel = theme === 'light' ? 'Dark mode' : 'Light mode';
  const themeShortcutIcon = theme === 'light' ? 'MoonIcon' : 'SunIcon';

  return (
    <>
      <Modal
        modalClassName='max-w-xl bg-main-background w-full p-8 rounded-2xl hover-animation'
        open={open}
        closeModal={closeModal}
      >
        <DisplayModal closeModal={closeModal} />
      </Modal>
      <Menu className='relative' as='div'>
        {({ open }): JSX.Element => {
          const isActive =
            open ||
            isNavLinkActive(asPath, '/settings') ||
            isNavLinkActive(asPath, '/privacy') ||
            isNavLinkActive(asPath, '/help-center');

          return (
            <>
              <Menu.Button className='group relative flex w-full py-1 outline-none'>
                <div
                  className={cn(
                    `custom-button flex min-h-[52px] items-center gap-4 self-start p-2 text-xl leading-7 transition
                   group-hover:bg-light-primary/10 group-focus-visible:ring-2 group-focus-visible:ring-[#878a8c]
                   dark:group-hover:bg-dark-primary/10 dark:group-focus-visible:ring-white xs:p-3
                   xl:pr-5`,
                    open && 'bg-light-primary/10 dark:bg-dark-primary/10',
                    isActive && 'font-bold text-main-accent'
                  )}
                >
                  <span className='flex h-7 w-7 shrink-0 items-center justify-center leading-none'>
                    <CustomIcon
                      className='block h-7 w-7 shrink-0'
                      iconName='TwitterMoreIcon'
                    />
                  </span>
                  <p className='hidden h-7 items-center leading-7 xl:flex'>
                    More
                  </p>
                </div>
              </Menu.Button>
              <AnimatePresence>
                {open && (
                  <Menu.Items
                    className='menu-container absolute -top-56 w-60 font-medium xl:w-11/12'
                    as={motion.div}
                    {...variants}
                    static
                  >
                    <Menu.Item>
                      {({ active }): JSX.Element => (
                        <MenuLink
                          className={cn(
                            'flex w-full gap-3 rounded-t-md p-4 duration-200',
                            active && 'bg-main-sidebar-background'
                          )}
                          href='/settings'
                        >
                          <HeroIcon iconName='Cog8ToothIcon' />
                          Settings and privacy
                        </MenuLink>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }): JSX.Element => (
                        <MenuLink
                          className={cn(
                            'flex w-full gap-3 p-4 duration-200',
                            active && 'bg-main-sidebar-background'
                          )}
                          href='/privacy'
                        >
                          <HeroIcon iconName='DocumentTextIcon' />
                          Privacy Policy
                        </MenuLink>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }): JSX.Element => (
                        <MenuLink
                          className={cn(
                            'flex w-full gap-3 p-4 duration-200',
                            active && 'bg-main-sidebar-background'
                          )}
                          href='/help-center'
                        >
                          <HeroIcon iconName='QuestionMarkCircleIcon' />
                          Help center
                        </MenuLink>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }): JSX.Element => (
                        <Button
                          className={cn(
                            'flex w-full gap-3 rounded-none p-4 duration-200',
                            active && 'bg-main-sidebar-background'
                          )}
                          {...themeShortcutHandlers}
                          title='Hold for display options'
                        >
                          <HeroIcon iconName={themeShortcutIcon} />
                          {themeShortcutLabel}
                        </Button>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }): JSX.Element => (
                        <Button
                          className={cn(
                            'flex w-full gap-3 rounded-none rounded-b-md p-4 duration-200',
                            active && 'bg-main-sidebar-background'
                          )}
                          onClick={openModal}
                        >
                          <HeroIcon iconName='PaintBrushIcon' />
                          Display
                        </Button>
                      )}
                    </Menu.Item>
                  </Menu.Items>
                )}
              </AnimatePresence>
            </>
          );
        }}
      </Menu>
    </>
  );
}
