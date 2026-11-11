// Stats view: period tiles and charts, top channels and the video table.
// Live updates (background rev bump) are throttled and deferred while the view is not visible; a section is
// repainted only when its data or state changed.
import { h } from '../../shared/h.ts';
import { onStatsChanged } from '../../shared/protocol.ts';
import type { ChannelSort, ChannelStat, Overview, StatsQuery } from '../../shared/types.ts';
import { consentCard } from '../consent.ts';
import type { ViewEnv } from '../registry.ts';
import { CHANNEL_STEP, channelsCard } from './channels.ts';
import { num } from './format.ts';
import { breakdowns, dailyCard, kpis } from './overview.ts';
import { choice } from './parts.ts';
import { buckets, RANGES, type Range, series, span, totals } from './period.ts';
import { createVideoTable, PAGE_STEP } from './table.ts';

const LIVE_MS = 4000; // at most one live refresh per window

export function mountStats(el: HTMLElement, env: ViewEnv): () => void {
  const q: StatsQuery = {
    sort: 'seen',
    filter: 'all',
    kind: 'all',
    channel: '',
    limit: PAGE_STEP,
    search: '',
  };
  let range: Range = 7;
  let chSort: ChannelSort = 'seen';
  let chLimit = CHANNEL_STEP;
  let declined = false; // "Not now" in this view: a one-line hint replaces the card
  let token = 0;
  let visible = false;
  let dirty = false;
  let liveTimer: ReturnType<typeof setTimeout> | undefined;
  const sig = { top: '', channels: '', rows: '' }; // what each section last painted

  const rangeBox = h('div');
  const note = h('div');
  const top = h('div', { class: 'stack' });
  const channelBox = h('div');
  const main = h('div', { class: 'stack' });
  const table = createVideoTable(env, q, () => refresh());

  const paintRange = (): void =>
    rangeBox.replaceChildren(
      choice(
        'seg-ctl',
        RANGES.map((r) => [r, r ? `${r} days` : 'All time'] as const),
        range,
        (r) => {
          range = r;
          paintRange();
          refresh();
        },
      ),
    );
  const paintNote = (empty: boolean): void => {
    const on = env.settings.get().statsEnabled;
    note.replaceChildren(
      ...(on
        ? empty
          ? [h('p', { class: 'muted' }, 'No stats yet. They fill up as you browse YouTube.')]
          : []
        : declined
          ? [
              h(
                'p',
                { class: 'muted actions' },
                'Stats are off, so nothing new is counted. ',
                h('button', { onclick: () => ((declined = false), refresh()) }, 'Enable stats…'),
              ),
            ]
          : [consentCard(() => ((declined = true), refresh()))]),
    );
  };
  const paintTop = (o: Overview): void => {
    const now = Date.now();
    const len = range || span(o.days, now);
    const cur = series(o.days, len, now);
    top.replaceChildren(
      kpis(totals(cur), totals(range ? series(o.days, len, now, len) : []), o),
      dailyCard(buckets(cur, 120)),
      breakdowns(totals(cur)),
      h(
        'p',
        { class: 'muted' },
        `${num(o.videos)} videos and ${num(o.channels)} channels tracked on this device.`,
      ),
    );
  };
  const paintChannels = (rows: readonly ChannelStat[]): void =>
    channelBox.replaceChildren(
      ...(rows.length
        ? [
            channelsCard(rows, chSort, chLimit, {
              sort: (s) => ((chSort = s), refresh()),
              more: () => ((chLimit += CHANNEL_STEP * 2), refresh()),
              pick: (name) => {
                Object.assign(q, { channel: name, filter: 'all', limit: PAGE_STEP });
                table.sync();
                refresh();
                table.el.scrollIntoView({ block: 'start', behavior: 'smooth' });
              },
            }),
          ]
        : []),
    );

  function refresh(): void {
    dirty = false;
    const my = ++token;
    const s = env.settings.get();
    void Promise.all([
      env.call('overview', null),
      env.call('channels', { sort: chSort, limit: chLimit }),
      env.call('query', q),
    ]).then(
      ([o, channels, page]) => {
        if (my !== token) return;
        const empty = o.videos === 0 && o.days.length === 0;
        paintNote(empty);
        main.hidden = empty;
        const next = {
          top: JSON.stringify([o, range, new Date().getDate()]),
          channels: JSON.stringify([channels, chSort, chLimit]),
          rows: JSON.stringify([page, s.hideThreshold, s.thumbnailsEnabled]),
        };
        if (next.top !== sig.top) paintTop(o);
        if (next.channels !== sig.channels) paintChannels(channels);
        if (next.rows !== sig.rows) table.show(page);
        Object.assign(sig, next);
      },
      (e: unknown) => note.replaceChildren(h('p', { class: 'error' }, String(e))),
    );
  }

  const live = (): void => {
    if (!visible || document.visibilityState !== 'visible') dirty = true;
    else
      liveTimer ??= setTimeout(() => {
        liveTimer = undefined;
        refresh();
      }, LIVE_MS);
  };
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible && dirty) refresh();
  });
  io.observe(el);
  const onVisibility = (): void => {
    if (dirty) live();
  };
  document.addEventListener('visibilitychange', onVisibility);

  main.append(top, channelBox, table.el);
  el.replaceChildren(
    h(
      'div',
      { class: 'stats' },
      h('div', { class: 'stats-head' }, h('h2', null, 'Stats'), rangeBox),
      note,
      main,
    ),
  );
  paintRange();
  paintNote(false);
  refresh();
  const offSettings = env.settings.subscribe(refresh);
  const offStats = onStatsChanged(live);
  return () => {
    offSettings();
    offStats();
    io.disconnect();
    clearTimeout(liveTimer);
    document.removeEventListener('visibilitychange', onVisibility);
    token = -1;
  };
}
