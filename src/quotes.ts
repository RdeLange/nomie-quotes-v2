// The quote lists: the two Stoic lists, lists the user makes, the quote of the day, and the note a quote opens.
// The screens only show what this module works out.
import stoicEn from './data/stoic-en.json';
import stoicNl from './data/stoic-nl.json';

export type Quote = { text: string; author: string };

export type Kind = 'stoic-en' | 'stoic-nl' | 'custom';

export type QuoteList = {
  // the id is what a dashboard widget points at (its widget index), so the presets keep the ids of v1: 1 and 2
  id: string;
  kind: Kind;
  name: string;
  description: string;
  emoji: string;
  // the colour of the speech balloon on the dashboard
  color: string;
  // the quotes of a custom list. The Stoic lists keep their quotes in the plugin.
  quotes: Quote[];
};

export const KIND_NAMES: Record<Kind, string> = { 'stoic-en': 'Stoic English', 'stoic-nl': 'Stoic Nederlands', custom: 'Your own quotes' };
export const COLOURS = ['#C47ADA', '#FF2D55', '#FF9500', '#34C759', '#00C7BE', '#007AFF', '#5856D6', '#AF52DE', '#A2845E', '#8E8E93', '#FF3B30', '#30B0C7'];

const KINDS: Kind[] = ['stoic-en', 'stoic-nl', 'custom'];
const STOIC: Record<'stoic-en' | 'stoic-nl', Quote[]> = { 'stoic-en': stoicEn, 'stoic-nl': stoicNl };

const PRESETS: Array<Omit<QuoteList, 'id'>> = [
  { kind: 'stoic-en', name: 'Stoic-en', description: 'The Stoic teachers, in English', emoji: '🏛️', color: '#C47ADA', quotes: [] },
  { kind: 'stoic-nl', name: 'Stoic-nl', description: 'The same Stoic teachers, in Dutch', emoji: '🏛️', color: '#C47ADA', quotes: [] },
];

// The starter a new user can pick, as in v1
export const KICK_STARTER: Omit<QuoteList, 'id'> = {
  kind: 'custom',
  name: 'Kick Starter',
  description: 'A simple quote list to start with',
  emoji: '𓇬',
  color: '#C47ADA',
  quotes: [{ text: 'Nomie has been a labor of love for me for the past 8 years, and I am deeply grateful for the support and loyalty of the community.', author: '❤️ Brandon' }],
};

// The two lists a new user starts with
export const defaultLists = (): QuoteList[] => PRESETS.map((preset, i) => ({ ...preset, id: String(i + 1) }));

export const nextId = (lists: QuoteList[]): string => String(Math.max(0, ...lists.map((l) => Number(l.id) || 0)) + 1);

// A new list, not yet saved, with the next free id
export const newList = (base: Omit<QuoteList, 'id'>, lists: QuoteList[]): QuoteList => ({ ...base, id: nextId(lists), quotes: base.quotes.map((q) => ({ ...q })) });

const isColour = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

// A quote needs its text. The author may be empty.
export const cleanQuotes = (quotes: unknown): Quote[] =>
  Array.isArray(quotes)
    ? quotes.flatMap((q: any) => (typeof q?.text === 'string' && q.text.trim() !== '' ? [{ text: q.text.trim(), author: String(q.author ?? '').trim() }] : []))
    : [];

// Reads the saved lists. Anything that is not well formed is left out; no lists at all gives the two Stoic lists.
export const normaliseLists = (saved: unknown): QuoteList[] => {
  if (!Array.isArray(saved) || saved.length === 0) return defaultLists();
  return saved.flatMap((l: any): QuoteList[] => {
    if (!l || typeof l.id !== 'string' || !KINDS.includes(l.kind)) return [];
    const kind = l.kind as Kind;
    return [
      {
        id: l.id,
        kind,
        name: String(l.name ?? '').trim() || KIND_NAMES[kind],
        description: String(l.description ?? ''),
        emoji: String(l.emoji ?? ''),
        color: isColour(l.color) ? l.color : COLOURS[0],
        quotes: kind === 'custom' ? cleanQuotes(l.quotes) : [],
      },
    ];
  });
};

// The quotes of a list: the Stoic lists have theirs in the plugin, a custom list has its own
export const quotesOf = (list: QuoteList): Quote[] => (list.kind === 'custom' ? list.quotes : STOIC[list.kind]);

// The first thing wrong with a list, or null when it can be saved
export const listProblem = (list: QuoteList): string | null => {
  if (!list.name.trim()) return 'Give the list a name.';
  if (list.kind === 'custom' && cleanQuotes(list.quotes).length === 0) return 'Add at least one quote.';
  return null;
};

// The quote of the day: the days since 1970 in the local time, taken round the list. The same quote all day.
export const quoteOfDay = (quotes: Quote[], now: Date): Quote | undefined => {
  if (quotes.length === 0) return undefined;
  const local = now.getTime() - now.getTimezoneOffset() * 60000;
  const day = Math.floor(local / 86400000);
  return quotes[day % quotes.length];
};

// The note a tap on a quote opens: the quote, ready for a reflection, as in v1
export const reflectionNote = (quote: Quote): string => `REFLECTIONS ON FOLLOWING QUOTE FROM ${quote.author}:\n${quote.text}\n=> \n`;
