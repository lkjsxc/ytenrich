// Trusted-Types-safe DOM builder: never touches innerHTML. All UI is built with this.
export type Child = Node | string | number | null | undefined | false | readonly Child[];
type AttrValue = string | number | boolean | null | undefined | ((e: Event) => void);
export type Attrs = Record<string, AttrValue>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) setAttrs(el, attrs);
  append(el, children);
  return el;
}

export function setAttrs(el: Element, attrs: Attrs): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'value' && el instanceof HTMLInputElement) el.value = String(value ?? '');
    else if (key === 'checked' && el instanceof HTMLInputElement) el.checked = value === true;
    else if (value === false || value === null || value === undefined) el.removeAttribute(key);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
}

export function append(parent: Node, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
}

export function replaceChildren(parent: Element, ...children: Child[]): void {
  parent.replaceChildren();
  append(parent, children);
}
