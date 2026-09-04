import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import { useMemberships } from './useMemberships';
import type { Tenant } from '../domain/tenant';

const getUserMosqueIdsMock = vi.fn();
const getMosqueMock = vi.fn();
const listHalaqatMock = vi.fn();

vi.mock('../data/users.repo', () => ({
  getUserMosqueIds: (...a: unknown[]) => getUserMosqueIdsMock(...a),
}));
vi.mock('../data/mosques.repo', () => ({
  getMosque: (...a: unknown[]) => getMosqueMock(...a),
  listHalaqat: (...a: unknown[]) => listHalaqatMock(...a),
}));

const CURRENT: Tenant = { mosqueId: 'altayseer', halaqaId: 'main' };

const mosque = (id: string, name: string) => ({ id, name, createdAt: 0 });
const halaqa = (id: string, name: string) => ({
  id,
  name,
  excludedDates: [],
  attendanceBadgeThreshold: 70,
});

function Probe({ uid }: { uid: string | null }) {
  const { options, loading } = useMemberships(uid, CURRENT);
  if (loading) return <span data-testid="out">loading</span>;
  return (
    <span data-testid="out">
      {options.map((o) => `${o.mosqueId}/${o.halaqaId}:${o.mosqueName}`).join('|') || 'empty'}
    </span>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getUserMosqueIdsMock.mockResolvedValue([]);
  getMosqueMock.mockResolvedValue(null);
  listHalaqatMock.mockResolvedValue([]);
});

describe('useMemberships', () => {
  it('reads nothing and asks for nothing when signed out', async () => {
    render(<Probe uid={null} />);
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('empty'));
    expect(getUserMosqueIdsMock).not.toHaveBeenCalled();
  });

  it('lists every halaqa of every indexed mosque', async () => {
    getUserMosqueIdsMock.mockResolvedValue(['altayseer', 'alnour']);
    getMosqueMock.mockImplementation(async (id: string) =>
      id === 'altayseer' ? mosque(id, 'مسجد التيسير') : mosque(id, 'مسجد النور'),
    );
    listHalaqatMock.mockImplementation(async (id: string) =>
      id === 'altayseer' ? [halaqa('main', 'الحلقة')] : [halaqa('h1', 'الحفظة')],
    );

    render(<Probe uid="uid_1" />);
    await waitFor(() =>
      expect(screen.getByTestId('out')).toHaveTextContent(
        'altayseer/main:مسجد التيسير|alnour/h1:مسجد النور',
      ),
    );
  });

  /**
   * The index is client-writable, so it can name a mosque the rules will
   * refuse. That read throwing must not blank the whole list — the mosque
   * simply isn't offered.
   */
  it('drops a mosque whose read is refused, keeping the rest', async () => {
    getUserMosqueIdsMock.mockResolvedValue(['altayseer', 'forged']);
    getMosqueMock.mockImplementation(async (id: string) => {
      if (id === 'forged') throw new Error('permission-denied');
      return mosque(id, 'مسجد التيسير');
    });
    listHalaqatMock.mockImplementation(async (id: string) => {
      if (id === 'forged') throw new Error('permission-denied');
      return [halaqa('main', 'الحلقة')];
    });

    render(<Probe uid="uid_1" />);
    await waitFor(() =>
      expect(screen.getByTestId('out')).toHaveTextContent('altayseer/main:مسجد التيسير'),
    );
    expect(screen.getByTestId('out')).not.toHaveTextContent('forged');
  });

  /**
   * Nobody has an index document yet. Falling back to the mosque already open
   * means this ships without writing a single Firestore document first, and a
   * teacher never sees an empty picker for the halaqa they are standing in.
   */
  it('falls back to the mosque already open when there is no index', async () => {
    getUserMosqueIdsMock.mockResolvedValue([]);
    getMosqueMock.mockResolvedValue(mosque('altayseer', 'مسجد التيسير'));
    listHalaqatMock.mockResolvedValue([halaqa('main', 'الحلقة')]);

    render(<Probe uid="uid_1" />);
    await waitFor(() =>
      expect(screen.getByTestId('out')).toHaveTextContent('altayseer/main:مسجد التيسير'),
    );
    expect(getMosqueMock).toHaveBeenCalledWith('altayseer');
  });

  it('survives the index read itself failing', async () => {
    getUserMosqueIdsMock.mockRejectedValue(new Error('offline'));
    getMosqueMock.mockResolvedValue(mosque('altayseer', 'مسجد التيسير'));
    listHalaqatMock.mockResolvedValue([halaqa('main', 'الحلقة')]);

    render(<Probe uid="uid_1" />);
    await waitFor(() =>
      expect(screen.getByTestId('out')).toHaveTextContent('altayseer/main:مسجد التيسير'),
    );
  });

  it('never lists the same mosque twice when the index already names it', async () => {
    getUserMosqueIdsMock.mockResolvedValue(['altayseer']);
    getMosqueMock.mockResolvedValue(mosque('altayseer', 'مسجد التيسير'));
    listHalaqatMock.mockResolvedValue([halaqa('main', 'الحلقة')]);

    render(<Probe uid="uid_1" />);
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('altayseer/main'));
    expect(getMosqueMock).toHaveBeenCalledTimes(1);
  });
});
