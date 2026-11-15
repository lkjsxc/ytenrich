// A row owns its disclosure; toggling it never repaints the History list.
import { h } from '../shared/h.ts';
import type { OpenRow } from '../shared/types.ts';
import { kindBadge, openVideo, thumbUrl, videoUrl } from './open.ts';
import type { ViewEnv } from './registry.ts';

export const openTime = (time: number): string =>
  new Date(time).toLocaleTimeString('en', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
export const openDate = (time: number): string => {
  const d = new Date(time);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${openTime(time)}`;
};

export function historyRow(
  event: OpenRow,
  env: ViewEnv,
  expanded: Set<string>,
  list: HTMLElement,
): HTMLElement {
  const v = event.row;
  const scroller = (): HTMLElement =>
    list.closest<HTMLElement>('.body.own') ?? (document.scrollingElement as HTMLElement);
  const hold = (change: () => void): void => {
    const scroll = scroller();
    const top = scroll.scrollTop;
    change();
    scroll.scrollTop = top;
  };
  const details = h('div', { class: 'hopens', hidden: true });
  const mark = h(
    'button',
    {
      class: 'hcount muted',
      type: 'button',
      'aria-expanded': 'false',
      onclick: () => {
        if (expanded.has(event.id)) expanded.delete(event.id);
        else expanded.add(event.id);
        show();
      },
    },
    `×${v.opened}`,
  );
  let request = 0;
  function show(): void {
    const my = ++request;
    const on = expanded.has(event.id);
    mark.setAttribute('aria-expanded', String(on));
    hold(() => {
      details.hidden = !on;
    });
    if (!on) return;
    void env
      .call('videoOpens', { id: v.id })
      .then((opens) => {
        if (my !== request) return;
        hold(() => {
          const fragment = document.createDocumentFragment();
          for (const o of opens)
            fragment.append(
              h(
                'button',
                {
                  type: 'button',
                  class: o.id === event.id ? '' : 'muted',
                  onclick: () => {
                    const target = [...list.children].find(
                      (c) => (c as HTMLElement).dataset.open === o.id,
                    );
                    if (!target) return;
                    const scroll = scroller();
                    scroll.scrollTop +=
                      target.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
                  },
                },
                openDate(o.time),
              ),
            );
          if (v.opened > opens.length)
            fragment.append(
              h(
                'div',
                { class: 'muted' },
                `+ ${v.opened - opens.length} earlier, time not recorded`,
              ),
            );
          details.replaceChildren(fragment);
        });
      })
      .catch(() => undefined);
  }
  const link = (child: HTMLElement): HTMLElement =>
    h(
      'a',
      {
        href: videoUrl(v),
        onclick: (e) => openVideo(e as MouseEvent, v, env),
      },
      child,
    );
  const text = h(
    'div',
    { class: 'htext' },
    link(
      h(
        'span',
        null,
        v.title || v.id,
        kindBadge(v) ? h('span', { class: 'badge' }, kindBadge(v)) : null,
      ),
    ),
    h('div', { class: 'muted' }, v.channel),
    details,
  );
  const row = h(
    'div',
    {
      class: 'hrow',
      'data-open': event.id,
      onclick: (e) => {
        if (!(e.target as Element).closest('a, button, .hopens'))
          openVideo(e as MouseEvent, v, env);
      },
    },
    h('span', { class: 'muted num' }, openTime(event.time), v.opened > 1 ? mark : null),
    !__FIREFOX__ && env.settings.get().thumbnailsEnabled
      ? link(
          h('img', {
            class: v.kind === 'short' ? 'thumb tall' : 'thumb',
            crossorigin: 'anonymous',
            referrerpolicy: 'no-referrer',
            src: thumbUrl(v, 'default'),
            loading: 'lazy',
            alt: '',
          }),
        )
      : null,
    text,
  );
  if (expanded.has(event.id)) show();
  return row;
}
