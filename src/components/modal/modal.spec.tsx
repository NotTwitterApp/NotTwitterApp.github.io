import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Modal } from './modal';

// The composer removes its options while sending, then restores them in the
// same update that closes the dialog after a successful submission.
function Composer({ close }: { close: () => void }) {
  const [sending, setSending] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          setSending(true);
          setTimeout(() => {
            close();
            setSending(false);
          }, 50);
        }}
      >
        Send
      </button>
      <AnimatePresence initial={false}>
        {!sending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            Composer options
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

it('releases the app after sending restores controls while the modal closes', async () => {
  const action = jest.fn();
  function App() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button onClick={action}>App action</button>
        <Modal open={open} closeModal={() => setOpen(false)}>
          <Composer close={() => setOpen(false)} />
        </Modal>
      </>
    );
  }
  const { container } = render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Send' }));
  await waitFor(() => {
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.getAttribute('aria-hidden')).toBeNull();
    expect(container.inert).not.toBe(true);
  });
  fireEvent.click(screen.getByRole('button', { name: 'App action' }));
  expect(action).toHaveBeenCalledTimes(1);
});

it('closes independently of descendant exit animations', async () => {
  function App() {
    const [open, setOpen] = useState(true);
    return (
      <Modal open={open} closeModal={() => setOpen(false)}>
        <motion.button
          exit={{ opacity: 0, transition: { duration: 60 } }}
          onClick={() => setOpen(false)}
        >
          Close slow content
        </motion.button>
      </Modal>
    );
  }
  const { container } = render(<App />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Close slow content' })
  );
  await waitFor(() => {
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.inert).not.toBe(true);
    expect(container.getAttribute('aria-hidden')).toBeNull();
  });
});
