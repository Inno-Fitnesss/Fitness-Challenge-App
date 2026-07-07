import { describe, it, expect } from 'vitest';
import { pluralizeRu, pluralizeRuWithCount } from './russianPlural.ts';

const DAY_FORMS = ['день', 'дня', 'дней'] as const;

describe('pluralizeRu', () => {
  it('uses the "one" form for 1, 21, 31... (but not 11)', () => {
    expect(pluralizeRu(1, DAY_FORMS)).toBe('день');
    expect(pluralizeRu(21, DAY_FORMS)).toBe('день');
    expect(pluralizeRu(101, DAY_FORMS)).toBe('день');
  });

  it('uses the "few" form for 2-4, 22-24... (but not 12-14)', () => {
    expect(pluralizeRu(2, DAY_FORMS)).toBe('дня');
    expect(pluralizeRu(3, DAY_FORMS)).toBe('дня');
    expect(pluralizeRu(4, DAY_FORMS)).toBe('дня');
    expect(pluralizeRu(22, DAY_FORMS)).toBe('дня');
  });

  it('uses the "many" form for 0, 5-20, 11-14, 25...', () => {
    expect(pluralizeRu(0, DAY_FORMS)).toBe('дней');
    expect(pluralizeRu(5, DAY_FORMS)).toBe('дней');
    expect(pluralizeRu(11, DAY_FORMS)).toBe('дней');
    expect(pluralizeRu(12, DAY_FORMS)).toBe('дней');
    expect(pluralizeRu(13, DAY_FORMS)).toBe('дней');
    expect(pluralizeRu(14, DAY_FORMS)).toBe('дней');
    expect(pluralizeRu(25, DAY_FORMS)).toBe('дней');
  });

  it('handles negative counts the same as their absolute value', () => {
    expect(pluralizeRu(-1, DAY_FORMS)).toBe('день');
    expect(pluralizeRu(-11, DAY_FORMS)).toBe('дней');
  });
});

describe('pluralizeRuWithCount', () => {
  it('prefixes the number to the chosen form', () => {
    expect(pluralizeRuWithCount(3, DAY_FORMS)).toBe('3 дня');
    expect(pluralizeRuWithCount(0, DAY_FORMS)).toBe('0 дней');
  });
});