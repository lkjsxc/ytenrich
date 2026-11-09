export function toggleAttr(el: Element, name: string, on: boolean, value = ''): void {
  if (on) {
    if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  } else if (el.hasAttribute(name)) el.removeAttribute(name);
}
