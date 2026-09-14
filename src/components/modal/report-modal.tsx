import { useMemo, useState, type JSX } from 'react';
import { Dialog } from '@headlessui/react';
import cn from 'clsx';
import { toast } from 'react-hot-toast';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useTheme } from '@lib/context/theme-context';
import { isSubmitShortcut, SUBMIT_KEYSHORTCUTS } from '@lib/keyboard-shortcuts';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import type { KeyboardEvent } from 'react';
import type { ModerationReportReason } from '@lib/atproto/backend';

type ReportTarget = 'account' | 'tweet';

type ReportReasonOption = {
  id: ModerationReportReason;
  title: string;
  description: string;
  targets?: Readonly<ReportTarget[]>;
};

type ReportModalProps = {
  target: ReportTarget;
  username?: string;
  action: (
    reasonType: ModerationReportReason,
    reason?: string
  ) => Promise<void>;
  closeModal: () => void;
};

const reportReasonOptions: Readonly<ReportReasonOption[]> = [
  {
    id: 'spam',
    title: "It's suspicious or spam",
    description:
      'Fake engagement, repeated replies, unwanted promotion, or spam.'
  },
  {
    id: 'scam',
    title: "It's a scam or fraud",
    description: 'Phishing, fraud, fake giveaways, or other deceptive schemes.'
  },
  {
    id: 'impersonation',
    title: 'They are pretending to be someone else',
    description: 'Impersonation, fake identity, or misleading affiliation.',
    targets: ['account']
  },
  {
    id: 'misleading',
    title: "It's misleading",
    description: 'False, deceptive, or manipulated information.'
  },
  {
    id: 'sexual',
    title: 'It displays sensitive or adult media',
    description:
      'Adult content that is unwanted, mislabeled, or missing a warning.'
  },
  {
    id: 'harassment',
    title: "It's abusive or harmful",
    description:
      'Targeted harassment, threats, intimidation, or abusive behavior.'
  },
  {
    id: 'hate',
    title: 'It directs hate against a protected category',
    description: 'Hateful or dehumanizing content targeting protected groups.'
  },
  {
    id: 'private-info',
    title: 'It includes private information',
    description: 'Doxxing, private contact information, or other personal data.'
  },
  {
    id: 'violence',
    title: 'It threatens violence or physical harm',
    description: 'Threats, incitement, or encouragement of violence.'
  },
  {
    id: 'self-harm',
    title: 'It expresses intentions of self-harm or suicide',
    description: 'Self-harm, suicide, eating disorders, or dangerous behavior.'
  },
  {
    id: 'child-safety',
    title: 'It involves a child',
    description:
      'Child safety concerns, grooming, exploitation, or minor privacy.'
  },
  {
    id: 'prohibited-sales',
    title: 'It promotes illegal or regulated goods',
    description:
      'Prohibited sales, regulated services, or other rule violations.',
    targets: ['tweet']
  },
  {
    id: 'other',
    title: 'Something else',
    description: 'It does not fit these choices, but Bluesky should review it.'
  }
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Report could not be submitted.';
}

export function ReportModal({
  target,
  username,
  action,
  closeModal
}: ReportModalProps): JSX.Element {
  const [selectedReason, setSelectedReason] =
    useState<ReportReasonOption | null>(null);
  const [details, setDetails] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { hideBskySocialSuffix } = useTheme();
  const detailsCount = Array.from(details).length;
  const displayUsername =
    formatAtprotoDisplayIdentifier(username, { hideBskySocialSuffix }) ||
    'account';
  const title =
    target === 'tweet' ? 'Report Tweet' : `Report ${displayUsername}`;

  const options = useMemo(
    () =>
      reportReasonOptions.filter(
        ({ targets }) => !targets || targets.includes(target)
      ),
    [target]
  );

  const handleBack = (): void => {
    if (loading) return;
    setSelectedReason(null);
    setErrorMessage('');
  };

  const handleSubmit = async (): Promise<void> => {
    if (!selectedReason || loading) return;

    try {
      setLoading(true);
      setErrorMessage('');
      await action(selectedReason.id, details.trim() || undefined);
      toast.success('Report submitted');
      closeModal();
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDetailsKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ): void => {
    if (!isSubmitShortcut(event)) return;

    event.preventDefault();
    if (!loading) void handleSubmit();
  };

  return (
    <div className='flex max-h-[88vh] flex-col overflow-hidden'>
      <header className='flex h-[53px] shrink-0 items-center gap-5 border-b border-light-border px-4 dark:border-dark-border'>
        {selectedReason ? (
          <Button
            className='main-tab -ml-2 p-2 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
            onClick={handleBack}
          >
            <HeroIcon className='h-5 w-5' iconName='ArrowLeftIcon' />
          </Button>
        ) : (
          <Button
            className='main-tab -ml-2 p-2 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
            onClick={closeModal}
          >
            <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
          </Button>
        )}
        <Dialog.Title className='text-xl font-bold'>{title}</Dialog.Title>
      </header>
      {!selectedReason ? (
        <div className='overflow-y-auto'>
          <div className='px-8 pt-7 pb-3'>
            <h2 className='text-2xl font-extrabold'>
              What do you want to report?
            </h2>
            <p className='mt-2 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
              We will send your report to Bluesky moderation for review.
            </p>
          </div>
          <div className='pb-4'>
            {options.map((option) => (
              <button
                className='accent-tab flex w-full items-center gap-4 px-8 py-4 text-left
                           hover:bg-main-sidebar-background'
                key={option.id}
                type='button'
                onClick={(): void => setSelectedReason(option)}
              >
                <div className='min-w-0 flex-1'>
                  <p className='text-[15px] font-bold leading-5'>
                    {option.title}
                  </p>
                  <p className='mt-1 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
                    {option.description}
                  </p>
                </div>
                <HeroIcon
                  className='h-5 w-5 shrink-0 text-light-secondary dark:text-dark-secondary'
                  iconName='ChevronRightIcon'
                />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className='overflow-y-auto px-8 py-7'>
          <h2 className='text-2xl font-extrabold'>Add details?</h2>
          <p className='mt-2 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
            You selected:{' '}
            <span className='font-bold'>{selectedReason.title}</span>
          </p>
          <label className='mt-6 block'>
            <span className='text-[15px] font-bold'>Additional context</span>
            <textarea
              className='mt-2 min-h-[128px] w-full resize-none rounded-2xl border border-light-line-reply
                         bg-main-background p-4 text-[15px] leading-5 outline-none transition
                         placeholder:text-light-secondary focus:border-main-accent focus:ring-1
                         focus:ring-main-accent dark:border-dark-border dark:placeholder:text-dark-secondary'
              maxLength={2000}
              placeholder='Add any extra details for Bluesky moderation (optional)'
              value={details}
              aria-keyshortcuts={SUBMIT_KEYSHORTCUTS}
              onChange={({ target: { value } }): void => {
                setDetails(value);
                if (errorMessage) setErrorMessage('');
              }}
              onKeyDown={handleDetailsKeyDown}
            />
          </label>
          <div className='mt-2 flex items-center justify-between text-sm text-light-secondary dark:text-dark-secondary'>
            <span>Sent to Bluesky Moderation Service</span>
            <span
              className={cn(
                detailsCount > 1800 && 'text-accent-red',
                detailsCount <= 1800 &&
                  'text-light-secondary dark:text-dark-secondary'
              )}
            >
              {2000 - detailsCount}
            </span>
          </div>
          {errorMessage && (
            <p className='mt-4 text-[15px] leading-5 text-accent-red'>
              {errorMessage}
            </p>
          )}
          <div className='mt-7 flex flex-col gap-3 inner:py-2 inner:font-bold'>
            <Button
              className='custom-button main-tab bg-accent-red text-white hover:bg-accent-red/90
                         focus-visible:bg-accent-red/90 active:bg-accent-red/80'
              loading={loading}
              onClick={handleSubmit}
              aria-keyshortcuts={SUBMIT_KEYSHORTCUTS}
            >
              Submit report
            </Button>
            <Button
              className='border border-light-line-reply hover:bg-light-primary/10
                         focus-visible:bg-light-primary/10 active:bg-light-primary/20
                         dark:border-light-secondary dark:text-light-border
                         dark:hover:bg-light-border/10 dark:focus-visible:bg-light-border/10
                         dark:active:bg-light-border/20'
              disabled={loading}
              onClick={closeModal}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
