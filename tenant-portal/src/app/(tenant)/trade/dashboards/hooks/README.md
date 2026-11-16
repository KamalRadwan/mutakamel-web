# Dashboard list loading

`useDashboards` shares one active load controller across initial loads, page or
scope changes, manual reloads and refreshes after mutations. Each load aborts
its predecessor. After all four requests settle, an aborted load returns before
updating the list, navigation, default dashboard, template suggestion, catalogue,
errors or loading state. Cleanup cancels the active load on unmount or before
the next effect, including refreshes started outside the effect.

`useDashboards.test.tsx` covers out-of-order responses even when the transport
resolves aborted requests, and cancellation of a manual refresh on unmount.
