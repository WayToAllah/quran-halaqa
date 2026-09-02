import { describe, it, expect, vi, afterEach } from 'vitest';
import { sharePng } from './shareCard';

const blob = new Blob(['x'], { type: 'image/png' });

function withNavigator(nav: Record<string, unknown>) {
  vi.stubGlobal('navigator', nav);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sharePng', () => {
  it('hands the PNG to the OS share sheet as a file', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    withNavigator({ share, canShare: () => true });
    expect(await sharePng(blob, 'نجوم-الحضور.png', 'نجوم الحضور')).toBe('shared');
    const arg = share.mock.calls[0][0] as { files: File[] };
    expect(arg.files[0].name).toBe('نجوم-الحضور.png');
    expect(arg.files[0].type).toBe('image/png');
  });

  it('reports a user cancel as cancelled, not as a failure', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    withNavigator({ share, canShare: () => true });
    expect(await sharePng(blob, 'a.png', 't')).toBe('cancelled');
  });

  it('reports a blocked share as failed so the screen can say why', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    withNavigator({ share, canShare: () => true });
    expect(await sharePng(blob, 'a.png', 't')).toBe('failed');
  });

  it('reports unsupported when the browser cannot share files', async () => {
    withNavigator({});
    expect(await sharePng(blob, 'a.png', 't')).toBe('unsupported');
    withNavigator({ share: vi.fn(), canShare: () => false });
    expect(await sharePng(blob, 'a.png', 't')).toBe('unsupported');
  });

  it('never falls back to downloading the file', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    withNavigator({ share: vi.fn().mockRejectedValue(new Error('boom')), canShare: () => true });
    await sharePng(blob, 'a.png', 't');
    withNavigator({});
    await sharePng(blob, 'a.png', 't');
    expect(click).not.toHaveBeenCalled();
  });
});
