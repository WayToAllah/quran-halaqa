import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/preact';
import { useOnlineStatus } from './useOnlineStatus';

function Probe() {
  const online = useOnlineStatus();
  return <div>{online ? 'ONLINE' : 'OFFLINE'}</div>;
}

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

describe('useOnlineStatus', () => {
  afterEach(() => {
    cleanup();
    setOnLine(true);
  });

  it('starts from the browser flag', () => {
    setOnLine(false);
    render(<Probe />);
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
  });

  it('flips to offline and back on the window events', async () => {
    setOnLine(true);
    render(<Probe />);
    expect(screen.getByText('ONLINE')).toBeInTheDocument();

    await act(async () => {
      setOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();

    await act(async () => {
      setOnLine(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
  });

  it('stops listening once unmounted, so a late event cannot update it', async () => {
    render(<Probe />);
    cleanup();
    await act(async () => {
      setOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.queryByText('OFFLINE')).not.toBeInTheDocument();
  });
});
