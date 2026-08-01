export function isSafeCrmEntityHref(value: string): boolean {
  return value.startsWith("/crm/")
    && !value.startsWith("//")
    && !/[\\\u0000-\u001f\u007f]/u.test(value)
    && !/%(?:2e|2f|5c)/iu.test(value);
}
