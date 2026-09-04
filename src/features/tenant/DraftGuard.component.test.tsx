import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { useState } from 'preact/hooks';
import { DraftGuardProvider, useDraftGuard, useReportDraft } from './DraftGuard';

function Reporter() {
  const [typed, setTyped] = useState(false);
  useReportDraft(typed);
  return (
    <button type="button" onClick={() => setTyped((t) => !t)}>
      toggle
    </button>
  );
}

function Watcher() {
  const { hasDraft } = useDraftGuard();
  return <span data-testid="watch">{hasDraft ? 'draft' : 'clean'}</span>;
}

describe('DraftGuard', () => {
  it('starts clean', () => {
    render(
      <DraftGuardProvider>
        <Reporter />
        <Watcher />
      </DraftGuardProvider>,
    );
    expect(screen.getByTestId('watch')).toHaveTextContent('clean');
  });

  it('lets a screen report unsaved work to anyone watching', async () => {
    const user = userEvent.setup();
    render(
      <DraftGuardProvider>
        <Reporter />
        <Watcher />
      </DraftGuardProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'toggle' }));
    await waitFor(() => expect(screen.getByTestId('watch')).toHaveTextContent('draft'));
  });

  it('clears again once the work is saved or discarded', async () => {
    const user = userEvent.setup();
    render(
      <DraftGuardProvider>
        <Reporter />
        <Watcher />
      </DraftGuardProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'toggle' }));
    await waitFor(() => expect(screen.getByTestId('watch')).toHaveTextContent('draft'));
    await user.click(screen.getByRole('button', { name: 'toggle' }));
    await waitFor(() => expect(screen.getByTestId('watch')).toHaveTextContent('clean'));
  });

  /**
   * A screen that reports and then unmounts must not leave the app believing
   * there is still a draft — that would block a switch forever with no way to
   * clear it.
   */
  it('forgets a draft whose screen went away', async () => {
    function Host() {
      const [show, setShow] = useState(true);
      return (
        <>
          {show && <Reporter />}
          <Watcher />
          <button type="button" onClick={() => setShow(false)}>
            unmount
          </button>
        </>
      );
    }
    const user = userEvent.setup();
    render(
      <DraftGuardProvider>
        <Host />
      </DraftGuardProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'toggle' }));
    await waitFor(() => expect(screen.getByTestId('watch')).toHaveTextContent('draft'));
    await user.click(screen.getByRole('button', { name: 'unmount' }));
    await waitFor(() => expect(screen.getByTestId('watch')).toHaveTextContent('clean'));
  });

  // Reading is safe anywhere; reporting without a provider would be a silent
  // no-op that makes a screen believe it is protected when it isn't.
  it('reads clean outside a provider, and refuses to report', () => {
    render(<Watcher />);
    expect(screen.getByTestId('watch')).toHaveTextContent('clean');
    expect(() => render(<Reporter />)).toThrow(/DraftGuardProvider/);
  });
});
