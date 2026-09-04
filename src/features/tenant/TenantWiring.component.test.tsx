import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/preact';
import { ToastProvider } from '../../ui/ToastProvider';
import { TenantProvider } from './TenantContext';
import { StudentsScreen } from '../students/StudentsScreen';
import { DEFAULT_TENANT } from '../../config';

/**
 * The point of Phase 1: a screen must read the mosque/halaqa it is *rendered
 * under*, not a module-level constant baked in at build time. Asserting the
 * data hooks receive the provider's ids is the only check that actually fails
 * if someone reintroduces a hardcoded import.
 */
const useStudentsSpy = vi.fn();
const useAllRecordsSpy = vi.fn();

vi.mock('../../hooks/useStudents', () => ({
  useStudents: (...args: unknown[]) => {
    useStudentsSpy(...args);
    return { students: [], loaded: true };
  },
}));
vi.mock('../../hooks/useAllRecords', () => ({
  useAllRecords: (...args: unknown[]) => {
    useAllRecordsSpy(...args);
    return { records: [], loaded: true };
  },
}));
vi.mock('../../data/students.repo', () => ({
  saveStudent: vi.fn(),
  updateStudent: vi.fn(),
  deleteStudent: vi.fn(),
}));

function renderUnder(initial?: { mosqueId: string; halaqaId: string }) {
  return render(
    <ToastProvider>
      <TenantProvider initial={initial}>
        <StudentsScreen />
      </TenantProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('tenant wiring', () => {
  it('scopes a screen to the mosque it is rendered under', () => {
    renderUnder({ mosqueId: 'alnour', halaqaId: 'nashieen' });
    expect(useStudentsSpy).toHaveBeenCalledWith('alnour', 'nashieen');
    expect(useAllRecordsSpy).toHaveBeenCalledWith('alnour', 'nashieen');
  });

  it('still lands on مسجد التيسير when nothing has been picked', () => {
    renderUnder();
    expect(useStudentsSpy).toHaveBeenCalledWith(DEFAULT_TENANT.mosqueId, DEFAULT_TENANT.halaqaId);
  });
});
