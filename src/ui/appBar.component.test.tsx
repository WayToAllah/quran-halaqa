import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/preact';
import { useRef } from 'preact/hooks';
import { APP_BAR_FALLBACK, appBarHeight, useAppBarHeight } from './appBar';

function Bar() {
  const ref = useRef<HTMLElement>(null);
  useAppBarHeight(ref);
  return <header ref={ref}>bar</header>;
}

afterEach(() => document.documentElement.style.removeProperty('--app-bar-h'));

describe('app bar height', () => {
  it('falls back to the old fixed 69px before anything is measured', () => {
    expect(appBarHeight()).toBe(APP_BAR_FALLBACK);
    expect(APP_BAR_FALLBACK).toBe(69);
  });

  it('publishes the bar’s rendered height for what is pinned under it', () => {
    const orig = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = () => ({ height: 83.4 }) as DOMRect;
    try {
      render(<Bar />);
      expect(document.documentElement.style.getPropertyValue('--app-bar-h')).toBe('83px');
      expect(appBarHeight()).toBe(83);
    } finally {
      Element.prototype.getBoundingClientRect = orig;
    }
  });
});
