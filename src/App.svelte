<script lang="ts">
  import { onMount } from 'svelte';
  import { cleanQuotes, defaultLists, KICK_STARTER, KIND_NAMES, COLOURS, listProblem, newList, normaliseLists, quoteOfDay, quotesOf, reflectionNote, type Quote, type QuoteList } from './quotes';
  import { paletteFrom, glassFrom, tintTextFrom, dangerTextFrom, type Palette, type Glass } from './palette';
  import { t, setLanguage } from './i18n/index.svelte';
  import { onPrefsChange } from './prefs-live';

  // the presets as a new user can start from them
  const PRESET_LIST = defaultLists();

  let plugin: any;
  let view = $state<'modal' | 'widget'>('modal');
  let palette = $state<Palette>(paletteFrom(undefined));
  let glass = $state<Glass>(glassFrom(undefined));
  let tintText = $state(tintTextFrom(undefined));
  let dangerText = $state(dangerTextFrom(undefined));
  let scale = $state(1);

  // the modal: the list of quote lists, the choice of a starting point, or the editor of one list
  let lists = $state<QuoteList[]>([]);
  let loaded = $state(false);
  let screen = $state<'list' | 'choose' | 'edit'>('list');
  let draft = $state<QuoteList | null>(null);

  // the widget: the list its index points at, and the quote of the day
  const widgetIndex = new URLSearchParams(window.location.search).get('widgetindex');
  let widgetList = $state<QuoteList | null>(null);
  let quote = $state<Quote | undefined>(undefined);
  let status = $state<'ready' | 'missing'>('ready');

  const draftIsSaved = $derived(!!draft && lists.some((l) => l.id === draft!.id));
  const draftProblem = $derived(draft ? listProblem(draft) : null);
  // a long quote is set smaller, so it fits the widget
  // The size of the widget: the frame the plugin is drawn in, read again when the widget is resized
  let frame = $state({ width: window.innerWidth, height: window.innerHeight });
  // Read the frame again: when the widget opens, and whenever the frame is resized
  const readFrame = () => {
    frame = { width: window.innerWidth, height: window.innerHeight };
  };

  // The largest quote size that still fits the frame, with the app's text size on top. Words are wrapped at about half
  // the font size per character, and the header, the padding and the author line take their share of the height.
  const fittedSize = (text: string, width: number, height: number, multiplier: number): number => {
    const available = height - 56;
    for (let size = 48; size > 12; size--) {
      const px = size * multiplier;
      const perLine = Math.max(1, Math.floor((width - 24) / (px * 0.5)));
      const lines = Math.ceil(text.length / perLine);
      const needed = lines * px * 1.3 + px * 1.2;
      if (needed <= available) return px;
    }
    return 12 * multiplier;
  };
  const quotePx = $derived(quote ? fittedSize(quote.text, frame.width, frame.height, scale) : 16 * scale);

  const applyNomieValues = () => {
    if (!plugin?.prefs) return;
    palette = paletteFrom(plugin.prefs);
    setLanguage(plugin.prefs?.language);
    glass = glassFrom(plugin.prefs);
    tintText = tintTextFrom(plugin.prefs);
    dangerText = dangerTextFrom(plugin.prefs);
    scale = plugin.prefs.fontScale || 1;
  };

  // The lists are kept under 'lists'. The Nomie widget settings read the list of widgets under 'widgets' (id, name and emoji),
  // so that list is written with them. Storage keys all live in one file for the plugin, prefs.json.
  const save = async () => {
    await plugin?.storage.setItem('lists', $state.snapshot(lists));
    await plugin?.storage.setItem(
      'widgets',
      lists.map((l) => ({ widgetid: l.id, name: l.name, emoji: l.emoji })),
    );
  };

  const ensureLoaded = async () => {
    if (loaded) return;
    await plugin.storage.init();
    lists = normaliseLists(plugin.storage.getItem('lists'));
    await save();
    loaded = true;
  };

  // The dashboard widget shows the list its index names, and today's quote from it. Without an index it shows the first list.
  const loadWidget = async () => {
    await ensureLoaded();
    widgetList = widgetIndex ? lists.find((l) => l.id === widgetIndex) ?? null : lists[0] ?? null;
    if (!widgetList) {
      status = 'missing';
      return;
    }
    status = 'ready';
    quote = quoteOfDay(quotesOf(widgetList), new Date());
  };

  const openList = (list: QuoteList) => {
    draft = structuredClone($state.snapshot(list)) as QuoteList;
    screen = 'edit';
  };

  const startNew = (base: Omit<QuoteList, 'id'>) => {
    draft = newList(base, lists);
    screen = 'edit';
  };

  const presetBase = (preset: QuoteList): Omit<QuoteList, 'id'> => {
    const { id, ...base } = preset;
    return base;
  };

  const addQuote = () => {
    if (draft?.kind === 'custom') draft.quotes.push({ text: '', author: '' });
  };

  const removeQuote = (index: number) => {
    if (draft?.kind === 'custom') draft.quotes.splice(index, 1);
  };

  const saveDraft = async () => {
    if (!draft || draftProblem) return;
    const next: QuoteList = { ...$state.snapshot(draft), quotes: draft.kind === 'custom' ? cleanQuotes(draft.quotes) : [] };
    lists = draftIsSaved ? lists.map((l) => (l.id === next.id ? next : l)) : [...lists, next];
    await save();
    draft = null;
    screen = 'list';
  };

  const deleteDraft = async () => {
    if (!draft) return;
    const gone = draft;
    const res = await plugin.confirm(t('deleteQ'), t('deleteBody', { name: gone.name }));
    if (!res?.value) return;
    lists = lists.filter((l) => l.id !== gone.id);
    await save();
    draft = null;
    screen = 'list';
  };

  // Tapping the quote writes a note about it, ready for a reflection
  const tapQuote = () => {
    if (quote) plugin.openNoteEditor(reflectionNote(quote));
  };

  onMount(() => {
    plugin = new NomiePlugin({
      name: 'Nomie Quotes',
      emoji: '💬',
      description: 'A quote for the day from a list you choose or make, shown on the dashboard. Tap the quote to reflect on it in a note.',
      uses: ['openNoteEditor', 'getStorageItem', 'setStorageItem', 'confirm'],
      version: '2.0',
      addToCaptureMenu: true,
      addToMoreMenu: true,
      addToWidgets: true,
    });
    onPrefsChange(plugin, () => applyNomieValues());
    plugin.onRegistered(async () => {
      applyNomieValues();
      await ensureLoaded();
    });
    window.addEventListener('resize', readFrame);
    // the body fills the frame, so a change of the frame size shows here too
    new ResizeObserver(readFrame).observe(document.body);
    plugin.onWidget(async () => {
      readFrame();
      view = 'widget';
      applyNomieValues();
      await loadWidget();
    });
    plugin.onUIOpened(async () => {
      view = 'modal';
      applyNomieValues();
      await ensureLoaded();
      screen = 'list';
    });
  });
</script>

<div class="card" class:widget={view === 'widget'} style="--page: {palette.page}; --card: {palette.card}; --card-inner: {palette.cardInner}; --text: {palette.text}; --muted: {palette.textSecondary}; --line: {palette.separator}; --fill: {palette.fill}; --tint: {palette.tint}; --on-tint: {palette.onTint}; --tint-soft: {palette.tintSoft}; --danger: {dangerText}; --tint-text: {tintText}; --glass-fill: {glass.fill}; --glass-edge: {glass.edge}; --glass-blur: {glass.blur}; --glass-shadow: {glass.shadow}; --scale: {scale};">
  {#if view === 'widget'}
    <div class="balloon">
      <div class="head">
        <span>{widgetList?.emoji ?? '💬'}</span>
        <span class="title">{widgetList?.name ?? t('title')}</span>
      </div>
      {#if status === 'missing'}
        <p class="muted">{t('goneWidget')}</p>
      {:else if !quote}
        <p class="muted">{t('noQuotesList')}</p>
      {:else}
        <button class="quote" onclick={tapQuote} style="font-size: {quotePx}px;">
          <span class="text">“{quote.text}”</span>
          {#if quote.author}<span class="author">— {quote.author}</span>{/if}
        </button>
      {/if}
    </div>
  {:else}
    <header class="top">
      {#if screen !== 'list'}<button class="link" onclick={() => (screen = 'list')}>‹ {t('back')}</button>{/if}
      <h1>{screen === 'list' ? t('title') : draftIsSaved && draft ? draft.name || t('wordsQuote') : t('newList')}</h1>
    </header>
    {#if screen === 'list'}
      <p class="muted">{t('dayIntro')}</p>

      <section class="panel">
        {#each lists as list (list.id)}
          <button class="row" onclick={() => openList(list)}>
            <span class="badge" style="background: {list.color}">{list.emoji}</span>
            <span class="text">
              <span class="title">{list.name}</span>
              <span class="muted">{list.description || KIND_NAMES[list.kind]}</span>
            </span>
            <span class="muted">{t('quoteCount', { n: list.kind === 'custom' ? list.quotes.length : quotesOf(list).length })}</span>
          </button>
        {:else}
          <p class="muted pad">{t('noListsYet')}</p>
        {/each}
      </section>
      <button class="primary" onclick={() => (screen = 'choose')}>{t('newList')}</button>
    {:else if screen === 'choose'}
      <p class="muted">{t('chooseIntro')}</p>
      <div class="chips">
        {#each PRESET_LIST as preset (preset.id)}
          <button onclick={() => startNew(presetBase(preset))}>{preset.emoji} {preset.name}</button>
        {/each}
        <button onclick={() => startNew({ kind: 'custom', name: '', description: '', emoji: '💬', color: COLOURS[0], quotes: [{ text: '', author: '' }] })}>✏️ {t('ownQuotes')}</button>
        <button onclick={() => startNew(KICK_STARTER)}>{KICK_STARTER.emoji} {KICK_STARTER.name}</button>
      </div>
    {:else if draft}

      <section class="panel">
        <label class="field">
          <span class="muted">{t('name')}</span>
          <input class="input" bind:value={draft.name} placeholder={t('namePlaceholder')} />
        </label>
        <label class="field">
          <span class="muted">{t('description')}</span>
          <input class="input" bind:value={draft.description} placeholder={t('descPlaceholder')} />
        </label>
        <label class="field">
          <span class="muted">{t('emoji')}</span>
          <input class="input emoji" bind:value={draft.emoji} maxlength="4" />
        </label>
      </section>

      <h2>{t('colour')}</h2>
      <section class="panel swatches">
        {#each COLOURS as c (c)}
          <button class="swatch" class:picked={draft.color === c} style="background: {c}" aria-label={t('useColour')} onclick={() => (draft!.color = c)}></button>
        {/each}
      </section>

      {#if draft.kind === 'custom'}
        <h2>{t('quotesHead')}</h2>
        {#each draft.quotes as quoteRow, i (i)}
          <section class="panel quote-editor">
            <textarea class="input" rows="3" bind:value={quoteRow.text} placeholder={t('quotePlaceholder')}></textarea>
            <div class="author-row">
              <input class="input" bind:value={quoteRow.author} placeholder={t('authorPlaceholder')} />
              <button class="icon danger-text" onclick={() => removeQuote(i)} aria-label={t('removeQuote')}>🗑️</button>
            </div>
          </section>
        {/each}
        <button class="ghost" onclick={addQuote}>Add a quote</button>
      {:else}
        <p class="muted">{KIND_NAMES[draft.kind]} {t('listNote', { n: quotesOf(draft).length })}</p>
      {/if}

      {#if draftProblem}<p class="problem">{draftProblem}</p>{/if}
      <button class="primary" onclick={saveDraft} disabled={!!draftProblem}>{t('save')}</button>
      {#if draftIsSaved}<button class="danger" onclick={deleteDraft}>{t('deleteList')}</button>{/if}
    {/if}
  {/if}
</div>

<style>
  /* the app's text: its iOS font stack, and the rounded face for numbers (PLG-LF-07, PLG-LF-08) */
  :global(body) { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; -webkit-font-smoothing: antialiased; --ios-font-rounded: ui-rounded, -apple-system, system-ui, sans-serif; }
  /* the header is a Liquid Glass bar (D-glass): the title and the back link stay at the top, and the content scrolls under them */
  .top { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 12px; margin: -16px -16px 8px; padding: 16px 16px 10px; background: var(--glass-fill); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); border-bottom: 1px solid var(--glass-edge); }
  .top h1 { margin: 0; }
  .card { box-sizing: border-box; min-height: 100vh; padding: 16px; background: var(--page); color: var(--text); font-size: calc(16px * var(--scale)); line-height: 1.4; }
  /* the widget card is the card colour of the app; the quote sits directly on it */
  .card.widget { container-type: size; min-height: 0; height: 100vh; padding: 10px 12px; background: var(--card); font-size: calc(16px * var(--scale)); display: flex; flex-direction: column; }
  h1 { margin: 0; font-size: calc(26px * var(--scale)); font-weight: 700; }
  h2 { margin: 20px 0 6px; font-size: calc(13px * var(--scale)); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { margin: 4px 0; color: var(--muted); }
  .pad { padding: 12px 0; }
  .panel { padding: 8px 16px; border-radius: 16px; background: var(--card); margin: 12px 0; }
  .row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 0; border: 0; border-top: 1px solid var(--line); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .row:first-child { border-top: 0; }
  .text { display: flex; flex: 1; flex-direction: column; min-width: 0; }
  .title { font-weight: 600; }
  .badge { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; }
  .link { border: 0; background: transparent; color: var(--tint); font: inherit; padding: 0; cursor: pointer; }
  .field { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; }
  .input { box-sizing: border-box; width: 100%; padding: 10px 12px; border: 0; border-radius: 12px; background: var(--card-inner, var(--fill)); color: var(--text); font: inherit; }
  textarea.input { resize: vertical; }
  .emoji { width: 90px; }
  .swatches { display: flex; flex-wrap: wrap; gap: 10px; padding: 12px 16px; }
  .swatch { width: 28px; height: 28px; border: 0; border-radius: 50%; cursor: pointer; }
  .swatch.picked { outline: 2px solid var(--text); outline-offset: 2px; }
  .quote-editor { display: flex; flex-direction: column; gap: 8px; padding: 12px; }
  .author-row { display: flex; gap: 8px; align-items: center; }
  .author-row .input { flex: 1; min-width: 0; }
  .icon { border: 0; background: transparent; font-size: calc(18px * var(--scale)); cursor: pointer; }
  .danger-text { color: var(--danger); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .chips button { padding: 8px 12px; border: 0; border-radius: 10px; background: var(--fill); color: var(--text); font: inherit; cursor: pointer; }
  .primary { display: block; width: 100%; margin-top: 16px; padding: 12px; border: 0; border-radius: 12px; background: var(--tint); color: var(--on-tint); font: inherit; font-weight: 600; cursor: pointer; }
  .primary:disabled { opacity: 0.4; }
  .ghost { display: block; width: 100%; margin-top: 8px; padding: 12px; border: 0; border-radius: 12px; background: var(--fill); color: var(--text); font: inherit; font-weight: 600; cursor: pointer; }
  .danger { display: block; width: 100%; margin-top: 10px; padding: 12px; border: 0; border-radius: 12px; background: transparent; color: var(--danger); font: inherit; cursor: pointer; }
  .problem { margin: 12px 0 0; color: var(--danger); }
  /* the quote is set in the middle of the card, the author under it */
  .balloon { display: flex; flex: 1; flex-direction: column; min-height: 0; }
  .head { display: flex; align-items: center; gap: 6px; font-size: calc(15px * var(--scale)); font-weight: 600; color: var(--muted); }
  .quote { display: flex; flex: 1; flex-direction: column; justify-content: center; gap: 4px; min-height: 0; padding: 4px 2px; border: 0; background: transparent; color: var(--text); font: inherit; text-align: left; cursor: pointer; }
  .quote .text { font-style: italic; line-height: 1.25; flex: 0 1 auto; }
  .quote .author { align-self: flex-end; font-weight: 600; color: var(--muted); font-size: 0.75em; }
  .widget .balloon .muted { font-size: calc(12px * var(--scale)); }
</style>
