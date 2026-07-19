import { describe, it, expect } from 'vitest';
import { fbKey } from './rtdbKey';

describe('fbKey', () => {
  it('leaves a normal generated id untouched', () => {
    expect(fbKey('s_1751500000000_ab12c')).toBe('s_1751500000000_ab12c');
    expect(fbKey('r_1783227486292_ih825')).toBe('r_1783227486292_ih825');
    expect(fbKey('att_1783477788937_h4zk0')).toBe('att_1783477788937_h4zk0');
  });

  it('replaces each RTDB-illegal character with an underscore', () => {
    expect(fbKey('a.b')).toBe('a_b');
    expect(fbKey('a#b')).toBe('a_b');
    expect(fbKey('a$b')).toBe('a_b');
    expect(fbKey('a[b')).toBe('a_b');
    expect(fbKey('a]b')).toBe('a_b');
    expect(fbKey('a/b')).toBe('a_b');
  });

  it('replaces every illegal char in a string with many of them', () => {
    expect(fbKey('.#$[]/')).toBe('______');
  });

  it('is idempotent (sanitizing an already-safe key changes nothing)', () => {
    const once = fbKey('a.b#c');
    expect(fbKey(once)).toBe(once);
  });

  it('preserves high-entropy tokens that contain only safe characters', () => {
    const token = 'Xk92mQ7pLZ0aBcD3';
    expect(fbKey(token)).toBe(token);
  });
});
