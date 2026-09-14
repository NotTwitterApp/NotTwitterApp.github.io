import { useMemo, useState, type JSX } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { orderBy, query } from '@lib/atproto/store';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { useModal } from '@lib/hooks/useModal';
import { useCollection } from '@lib/hooks/useCollection';
import { useArrayDocument } from '@lib/hooks/useArrayDocument';
import { clearAllBookmarks } from '@lib/atproto/utils';
import {
  tweetsCollection,
  userBookmarksCollection
} from '@lib/atproto/collections';
import { HomeLayout, ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { MainHeader } from '@components/home/main-header';
import { MainContainer } from '@components/home/main-container';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { Tweet } from '@components/tweet/tweet';
import { StatsEmpty } from '@components/tweet/stats-empty';
import { Button } from '@components/ui/button';
import { ToolTip } from '@components/ui/tooltip';
import { HeroIcon } from '@components/ui/hero-icon';
import { CustomIcon } from '@components/ui/custom-icon';
import { Loading } from '@components/ui/loading';
import type { ReactElement, ReactNode } from 'react';

export default function Bookmarks(): JSX.Element {
  const { user } = useAuth();
  const { hideBskySocialSuffix } = useTheme();

  const { open, openModal, closeModal } = useModal();
  const [clearMenuOpen, setClearMenuOpen] = useState(false);

  const userId = user?.id as string;
  const displayUsername = formatAtprotoDisplayIdentifier(user?.username, {
    hideBskySocialSuffix
  });

  const { data: bookmarksRef, loading: bookmarksRefLoading } = useCollection(
    query(userBookmarksCollection(userId), orderBy('createdAt', 'desc')),
    { allowNull: true }
  );

  const tweetIds = useMemo(
    () => bookmarksRef?.map(({ id }) => id) ?? [],
    [bookmarksRef]
  );

  const { data: tweetData, loading: tweetLoading } = useArrayDocument(
    tweetIds,
    tweetsCollection,
    { includeUser: true }
  );

  const handleClear = async (): Promise<void> => {
    await clearAllBookmarks(userId);
    closeModal();
    toast.success('Successfully cleared all bookmarks');
  };

  const toggleClearMenu = (): void => setClearMenuOpen((open) => !open);

  const handleOpenClearModal = (): void => {
    setClearMenuOpen(false);
    openModal();
  };

  return (
    <MainContainer>
      <SEO title='Bookmarks / Not Twitter' />
      <Modal
        modalClassName='max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={open}
        closeModal={closeModal}
      >
        <ActionModal
          title='Clear all Bookmarks?'
          description='This can’t be undone and you’ll remove all Tweets you’ve added to your Bookmarks.'
          mainBtnClassName='bg-accent-red hover:bg-accent-red/90 active:bg-accent-red/75 accent-tab 
                            focus-visible:bg-accent-red/90'
          mainBtnLabel='Clear'
          action={handleClear}
          closeModal={closeModal}
        />
      </Modal>
      <MainHeader className='flex h-[53px] items-center justify-between'>
        <div className='-mb-1 flex flex-col'>
          <h2 className='-mt-1 text-xl font-bold'>Bookmarks</h2>
          <p className='text-xs text-light-secondary dark:text-dark-secondary'>
            {displayUsername}
          </p>
        </div>
        <div className='relative'>
          <Button
            className='dark-bg-tab group relative p-2 hover:bg-light-primary/10
                       active:bg-light-primary/20 dark:hover:bg-dark-primary/10
                       dark:active:bg-dark-primary/20'
            aria-label='More'
            onClick={toggleClearMenu}
          >
            <CustomIcon className='h-5 w-5' iconName='TwitterMoreIcon' />
            <ToolTip
              className='!-translate-x-10 translate-y-3 md:-translate-x-1/2'
              tip='More'
            />
          </Button>
          <AnimatePresence>
            {clearMenuOpen && (
              <motion.div
                className='menu-container absolute right-0 top-11 z-20 w-64 overflow-hidden py-2'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
              >
                <Button
                  className='accent-tab flex w-full items-center gap-3 rounded-none px-4 py-3
                             text-left font-bold hover:bg-light-primary/10
                             dark:hover:bg-dark-primary/10'
                  onClick={handleOpenClearModal}
                >
                  <HeroIcon className='h-5 w-5' iconName='TrashIcon' />
                  Clear all Bookmarks
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </MainHeader>
      <section className='mt-0.5'>
        {bookmarksRefLoading || tweetLoading ? (
          <Loading className='mt-5' />
        ) : !bookmarksRef ? (
          <StatsEmpty
            title='Save Tweets for later'
            description='Don’t let the good ones fly away! Bookmark Tweets to easily find them again in the future.'
            imageData={{ src: '/assets/no-bookmarks.png', alt: 'No bookmarks' }}
          />
        ) : (
          <AnimatePresence>
            {tweetData?.map((tweet) => (
              <Tweet {...tweet} key={tweet.id} />
            ))}
          </AnimatePresence>
        )}
      </section>
    </MainContainer>
  );
}

Bookmarks.getLayout = (page: ReactElement<any>): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <HomeLayout>{page}</HomeLayout>
    </MainLayout>
  </ProtectedLayout>
);
