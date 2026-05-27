import { safeCompare } from './safe-compare';

describe('safeCompare', () => {
  it('returns true for identical strings', () => {
    expect(safeCompare('super-secret-token', 'super-secret-token')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(safeCompare('aaaa', 'bbbb')).toBe(false);
  });

  it('returns false for strings of different length', () => {
    expect(safeCompare('short', 'short-but-longer')).toBe(false);
  });

  it('treats empty strings as equal', () => {
    expect(safeCompare('', '')).toBe(true);
  });

  it('returns false when only one value is empty', () => {
    expect(safeCompare('', 'non-empty')).toBe(false);
    expect(safeCompare('non-empty', '')).toBe(false);
  });

  it('handles multi-byte (unicode) values correctly', () => {
    expect(safeCompare('pásswörd', 'pásswörd')).toBe(true);
    // Same character count but different bytes
    expect(safeCompare('café', 'cafe')).toBe(false);
  });

  it('returns false for non-string provided values', () => {
    expect(safeCompare(undefined, 'expected')).toBe(false);
    expect(safeCompare(null, 'expected')).toBe(false);
    expect(safeCompare(1234, 'expected')).toBe(false);
    expect(safeCompare(['expected'], 'expected')).toBe(false);
    expect(safeCompare({}, 'expected')).toBe(false);
  });
});
