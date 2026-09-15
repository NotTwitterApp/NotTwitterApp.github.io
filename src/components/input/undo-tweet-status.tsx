import { useEffect, useState, type JSX } from 'react';
import { Button } from '@components/ui/button';

export function UndoTweetComposerStatus({
  expiresAt,
  durationSeconds,
  onUndo,
  onSendNow
}: {
  expiresAt: number;
  durationSeconds: number;
  onUndo: () => void;
  onSendNow: () => void;
}): JSX.Element {
  const [now, setNow] = useState(() => expiresAt - durationSeconds * 1000);
  const remaining = Math.max(
    0,
    Math.min(durationSeconds, (expiresAt - now) / 1000)
  );
  const ratio = durationSeconds > 0 ? remaining / durationSeconds : 0;
  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className='flex min-h-[64px] flex-wrap items-center gap-3 border-t border-light-border py-3 text-[15px] leading-5 dark:border-dark-border'>
      <svg
        className='h-5 w-5 shrink-0 -rotate-90 text-main-accent'
        viewBox='0 0 24 24'
        role='progressbar'
        aria-label='Time to undo Tweet'
        aria-valuemin={0}
        aria-valuemax={durationSeconds}
        aria-valuenow={Math.ceil(remaining)}
        aria-valuetext={`${Math.ceil(remaining)} seconds remaining`}
      >
        <circle
          cx='12'
          cy='12'
          r='9'
          fill='none'
          stroke='currentColor'
          strokeWidth='3'
          className='text-light-line-reply dark:text-dark-border'
        />
        <circle
          cx='12'
          cy='12'
          r='9'
          fill='none'
          stroke='currentColor'
          strokeWidth='3'
          pathLength='1'
          strokeDasharray={`${ratio} 1`}
        />
      </svg>
      <p className='mr-auto font-bold' role='status'>
        Sending Tweet…
      </p>
      <div className='ml-auto flex shrink-0 items-center gap-3'>
        <Button
          className='accent-tab rounded-full p-0 font-bold text-main-accent hover:underline'
          onClick={onSendNow}
        >
          Send now
        </Button>
        <Button
          className='rounded-full bg-main-accent px-4 py-2 font-bold text-white hover:bg-main-accent/90'
          onClick={onUndo}
        >
          Undo
        </Button>
      </div>
    </div>
  );
}
