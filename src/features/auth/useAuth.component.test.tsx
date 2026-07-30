import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/preact';

const getMembershipMock = vi.fn();
let authCallback: ((u: unknown) => void) | null = null;

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_a: unknown, cb: (u: unknown) => void) => {
    authCallback = cb;
    return () => {};
  },
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock('../../data/mosques.repo', () => ({
  getMembership: (...args: unknown[]) => getMembershipMock(...args),
}));

const { useAuth } = await import('./useAuth');

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="offline">{auth.offlineSession ? 'stale' : 'live'}</span>
      <button onClick={() => auth.retryMembership()}>retry</button>
    </div>
  );
}

function fbError(code: string) {
  return Object.assign(new Error(code), { code });
}

const USER = { uid: 'uid_1' };
const CACHE_KEY = 'halaqa:member:altayseer:uid_1';

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  authCallback = null;
  setOnLine(true);
});

afterEach(() => {
  cleanup();
  setOnLine(true);
});

async function signIn() {
  render(<Probe />);
  await waitFor(() => expect(authCallback).toBeTruthy());
  authCallback!(USER);
}

describe('useAuth — membership outcomes', () => {
  it('opens the app and remembers the confirmation when the server says yes', async () => {
    getMembershipMock.mockResolvedValue({ role: 'owner' });
    await signIn();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('offline')).toHaveTextContent('live');
    expect(localStorage.getItem(CACHE_KEY)).toContain('owner');
  });

  it('denies when the server answers that there is no membership', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ role: 'owner' }));
    getMembershipMock.mockResolvedValue(null);
    await signIn();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('denied'));
    // A revoked account must not keep opening offline off an old confirmation.
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('opens offline against a previous confirmation instead of locking out', async () => {
    // This is the reported lockout: the session is valid, the device has been
    // confirmed before, and only the network is missing.
    localStorage.setItem(CACHE_KEY, JSON.stringify({ role: 'owner' }));
    setOnLine(false);
    getMembershipMock.mockRejectedValue(fbError('unavailable'));
    await signIn();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('offline')).toHaveTextContent('stale');
  });

  it('reports unreachable — NOT denied — when it cannot ask and has no record', async () => {
    setOnLine(false);
    getMembershipMock.mockRejectedValue(fbError('unavailable'));
    await signIn();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unreachable'));
  });

  it('still denies on a real refusal even with a cached confirmation', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ role: 'owner' }));
    getMembershipMock.mockRejectedValue(fbError('permission-denied'));
    await signIn();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('denied'));
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('recovers on retry once the connection is back, without a new sign-in', async () => {
    setOnLine(false);
    getMembershipMock.mockRejectedValue(fbError('unavailable'));
    await signIn();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unreachable'));

    setOnLine(true);
    getMembershipMock.mockResolvedValue({ role: 'owner' });
    fireEvent.click(screen.getByText('retry'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('offline')).toHaveTextContent('live');
  });

  it('goes back to signed-out when the session ends', async () => {
    getMembershipMock.mockResolvedValue({ role: 'owner' });
    await signIn();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    authCallback!(null);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed-out'));
  });
});
