/** Russian plural forms: [one, few, many] — e.g. ['день', 'дня', 'дней'] */
export type RussianPluralForms = readonly [one: string, few: string, many: string];

export function pluralizeRu(count: number, forms: RussianPluralForms): string {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;

  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export function pluralizeRuWithCount(count: number, forms: RussianPluralForms): string {
  return `${count} ${pluralizeRu(count, forms)}`;
}
