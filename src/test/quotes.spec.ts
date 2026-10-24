import { describe, expect, it } from 'vitest';
import { cleanQuotes, defaultLists, KICK_STARTER, listProblem, newList, normaliseLists, quoteOfDay, quotesOf, reflectionNote, type QuoteList } from '../quotes';

const mine = (over: Partial<QuoteList> = {}): QuoteList => ({ id: '3', kind: 'custom', name: 'Mine', description: '', emoji: '💬', color: '#C47ADA', quotes: [{ text: 'Keep going.', author: 'Me' }], ...over });

describe('the lists', () => {
  it('start with the two Stoic lists, with the ids of v1', () => {
    expect(defaultLists().map((l) => [l.id, l.name, l.kind])).toEqual([
      ['1', 'Stoic-en', 'stoic-en'],
      ['2', 'Stoic-nl', 'stoic-nl'],
    ]);
  });

  it('the Stoic lists have their quotes in the plugin, in English and in Dutch', () => {
    const [en, nl] = defaultLists();
    expect(quotesOf(en).length).toBe(1774);
    expect(quotesOf(nl).length).toBe(1774);
    expect(quotesOf(en)[0].text).not.toBe(quotesOf(nl)[0].text);
  });

  it('a new list gets the next free id', () => {
    expect(newList(KICK_STARTER, defaultLists()).id).toBe('3');
    expect(newList(KICK_STARTER, [mine({ id: '9' })]).id).toBe('10');
  });

  it('reads saved lists, keeps the quotes of a custom list, and leaves out a list it cannot read', () => {
    const [list] = normaliseLists([{ id: '5', kind: 'custom', name: ' ', color: 'nope', quotes: [{ text: ' Hi ', author: 'A' }, { text: '  ' }, 4] }]);
    expect(list.name).toBe('Your own quotes');
    expect(list.color).toBe('#C47ADA');
    expect(list.quotes).toEqual([{ text: 'Hi', author: 'A' }]);
    expect(normaliseLists([{ kind: 'custom' }, { id: '6', kind: 'other' }])).toEqual([]);
    expect(normaliseLists(undefined)).toEqual(defaultLists());
  });

  it('a Stoic list ignores any quotes saved with it', () => {
    const [list] = normaliseLists([{ id: '1', kind: 'stoic-en', name: 'Stoic-en', quotes: [{ text: 'x', author: 'y' }] }]);
    expect(list.quotes).toEqual([]);
  });
});

describe('saving a list', () => {
  it('needs a name and an emoji, because the dashboard settings list it by both', () => {
    expect(listProblem(mine({ emoji: ' ' }))).toBeTruthy();
    expect(normaliseLists([{ id: '7', kind: 'custom', emoji: '' }])[0].emoji).toBe('💬');
  });

  it('needs a name, and a custom list needs a quote with text', () => {
    expect(listProblem(mine({ name: ' ' }))).toBeTruthy();
    expect(listProblem(mine({ quotes: [{ text: ' ', author: 'A' }] }))).toBeTruthy();
    expect(listProblem(mine())).toBeNull();
    expect(listProblem(defaultLists()[0])).toBeNull();
  });

  it('cleanQuotes trims and drops quotes without text', () => {
    expect(cleanQuotes([{ text: ' a ', author: ' b ' }, { text: '', author: 'c' }])).toEqual([{ text: 'a', author: 'b' }]);
  });
});

describe('the quote of the day', () => {
  const quotes = [{ text: 'one', author: 'A' }, { text: 'two', author: 'B' }, { text: 'three', author: 'C' }];

  it('is the same all day and changes from one day to the next', () => {
    const morning = new Date(2026, 9, 25, 8, 0);
    const evening = new Date(2026, 9, 25, 22, 0);
    const nextDay = new Date(2026, 9, 26, 8, 0);
    expect(quoteOfDay(quotes, morning)).toEqual(quoteOfDay(quotes, evening));
    expect(quoteOfDay(quotes, nextDay)).not.toEqual(quoteOfDay(quotes, morning));
  });

  it('goes round the list, and an empty list has no quote', () => {
    const day = new Date(2026, 9, 25, 12, 0);
    const later = new Date(2026, 9, 25 + quotes.length, 12, 0);
    expect(quoteOfDay(quotes, later)).toEqual(quoteOfDay(quotes, day));
    expect(quoteOfDay([], day)).toBeUndefined();
  });
});

describe('the reflection note', () => {
  it('starts with the quote and its author, ready for a reflection, as in v1', () => {
    expect(reflectionNote({ text: 'Keep going.', author: 'Me' })).toBe('REFLECTIONS ON FOLLOWING QUOTE FROM Me:\nKeep going.\n=> \n');
  });
});
