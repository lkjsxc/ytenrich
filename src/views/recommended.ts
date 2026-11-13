// Recommended: what YouTube showed you and you have not opened, ordered by your own record (`shared/recommend.ts`).
// Every tab has its own settings (⚙, `reco-spec.ts`): kinds, channel (all, this page's, or one), order, grouping.
import { h, replaceChildren } from '../shared/h.ts';
import { onStatsChanged } from '../shared/protocol.ts';
import type { RecoPage, RecoQuery } from '../shared/types.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { autoMore, grow, type Keyed, keyed } from './more.ts';
import { channelHead, images, videoCard } from './reco-card.ts';
import { recoNotes } from './reco-notes.ts';
import { recoPanel } from './reco-panel.ts';
import { parseSpec, type RecoSpec, specTitle, toQuery } from './reco-spec.ts';
import type { ViewEnv } from './registry.ts';

const STEP = 40;
const SETTLE_MS = 3000; // after a navigation the list still takes in what arrives (the opened video, new offers)

/** Why a list is empty, in words for its query. */
function emptyText(env: ViewEnv, spec: RecoSpec, q: RecoQuery | null): string {
  if (!env.settings.get().statsEnabled)
    return 'This list is built from stats, which are off (see the Stats tab).';
  if (!q && spec.scope === 'page')
    return env.channel
      ? 'This tab lists the channel of the page you are on. Open a video or a channel.'
      : 'This tab follows the channel of the YouTube page it is on.';
  if (!q) return 'Type a channel name in ⚙.';
  if (q.channel)
    return `Nothing of ${q.channel} yet. Its videos collect here as YouTube shows them to you.`;
  return 'Nothing yet. Recommendations YouTube puts on your pages collect here until you open them.';
}

export function mountRecommended(el: HTMLElement, env: ViewEnv, initial: RecoSpec): () => void {
  let spec = initial;
  let open = false; // the ⚙ panel
  let limit = STEP;
  let token = 0;
  let sig = '';
  let visible = false;
  let dirty = false;
  let settleUntil = 0;
  const head = h('div');
  const cards = h('div');
  const foot = h('div');
  const query = (): RecoQuery | null => toQuery(spec, env.channel?.get() ?? '');

  const paintHead = (): void =>
    replaceChildren(
      head,
      h(
        'div',
        { class: 'rbar' },
        h(
          'button',
          {
            class: open ? 'rgear on' : 'rgear',
            title: 'What this tab shows',
            'aria-expanded': String(open),
            onclick: () => ((open = !open), paintHead()),
          },
          '⚙',
        ),
      ),
      open ? recoPanel(spec, initial, env, setSpec) : null,
      recoNotes(env.settings.get()),
    );
  function setSpec(next: RecoSpec, save = true): void {
    spec = next;
    limit = STEP;
    if (save) saveViewState(env.instance, { spec, title: specTitle(spec) });
    env.setTitle?.(specTitle(spec));
    paintHead();
    refresh();
  }

  const paint = (page: RecoPage, q: RecoQuery): void => {
    const meta = env.settings.get().recoMeta;
    const img = images(env);
    const stats = new Map(page.channels.map((c) => [c.name, c])); // bound: the channels of one page
    cards.className = img ? 'rgrid' : 'rgrid text';
    cards.hidden = !page.rows.length;
    const bare = q.group || Boolean(q.channel);
    const items: Keyed[] = [];
    let channel = '';
    for (const v of page.rows) {
      if (q.group && v.channel !== channel) {
        const c = stats.get(v.channel);
        items.push([
          `ch${meta}${img}${v.channel}${c?.icon}${c?.opened}${c?.seen}`,
          () => channelHead(v.channel, c, env),
        ]);
      }
      channel = v.channel;
      const key = `${bare}${meta}${img}${v.id}${v.seen}${v.opened}${v.title}${v.published}`;
      items.push([key, () => videoCard(v, env, bare)]);
    }
    keyed(cards, items);
    replaceChildren(
      foot,
      page.rows.length ? null : h('p', { class: 'muted' }, emptyText(env, spec, q)),
      autoMore(page.more, limit, () => {
        limit = grow(limit, STEP);
        refresh();
      }),
    );
  };

  function refresh(): void {
    dirty = false;
    const my = ++token;
    const q = query();
    if (!q) {
      sig = '';
      keyed(cards, []);
      cards.hidden = true;
      replaceChildren(foot, h('p', { class: 'muted' }, emptyText(env, spec, q)));
      return;
    }
    env.call('recommend', { query: q, limit }).then(
      (page) => {
        const next = JSON.stringify([q, page, images(env), env.settings.get().recoMeta]);
        if (my !== token || next === sig) return;
        sig = next;
        paint(page, q);
      },
      (e: unknown) => foot.replaceChildren(h('p', { class: 'error' }, String(e))),
    );
  }

  // One list per page view: every navigation reloads it from the top. After it settles the order holds while it
  // is on screen (it shifts as recommendations arrive) and catches up when it is shown again.
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible && dirty) refresh();
  });
  io.observe(el);
  const offPage = env.page?.subscribe(() => {
    settleUntil = Date.now() + SETTLE_MS;
    limit = STEP;
    el.closest('.body')?.scrollTo({ top: 0 });
    refresh();
  });
  const offChannel = env.channel?.subscribe(() => {
    if (spec.scope === 'page') refresh();
  });
  const offStats = onStatsChanged(() => {
    if (visible && cards.childElementCount && Date.now() > settleUntil) dirty = true;
    else refresh();
  });
  const offSettings = env.settings.subscribe(() => {
    paintHead();
    refresh();
  });
  el.replaceChildren(head, cards, foot);
  paintHead();
  refresh();
  void loadViewState<{ spec: unknown; title: string }>(env.instance).then((state) => {
    if (token < 0) return;
    const stored = parseSpec(state.spec, initial);
    if (state.title !== specTitle(stored))
      saveViewState(env.instance, { spec: stored, title: specTitle(stored) });
    if (JSON.stringify(stored) !== JSON.stringify(spec)) setSpec(stored, false);
    else env.setTitle?.(specTitle(stored));
  });
  return () => {
    io.disconnect();
    offStats();
    offPage?.();
    offChannel?.();
    offSettings();
    token = -1;
  };
}
