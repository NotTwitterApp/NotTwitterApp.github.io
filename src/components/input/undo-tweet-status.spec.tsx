import { act, fireEvent, render, screen } from '@testing-library/react';
import { UndoTweetComposerStatus } from './undo-tweet-status';

afterEach(() => jest.useRealTimers());
it('counts down the undo window and exposes both actions', () => {
  jest.useFakeTimers();
  const onUndo = jest.fn(),
    onSendNow = jest.fn();
  const { unmount } = render(
    <UndoTweetComposerStatus
      expiresAt={Date.now() + 20_000}
      durationSeconds={20}
      onUndo={onUndo}
      onSendNow={onSendNow}
    />
  );
  const timer = screen.getByRole('progressbar', { name: 'Time to undo Tweet' });
  expect(timer.getAttribute('aria-valuenow')).toBe('20');
  act(() => jest.advanceTimersByTime(5000));
  expect(timer.getAttribute('aria-valuenow')).toBe('15');
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(onUndo).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
  expect(onSendNow).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(30_000));
  expect(timer.getAttribute('aria-valuenow')).toBe('0');
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});
