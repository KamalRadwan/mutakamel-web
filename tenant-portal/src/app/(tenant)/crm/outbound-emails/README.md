# Outbound email history

The list keeps opaque cursors within the active status filter. Changing the
filter, reloading the first page, or unmounting cancels pending requests and
invalidates their generation. Even if cancellation arrives too late, obsolete
responses cannot change rows, pagination, errors, or loading indicators.
Starting a first-page request clears the previous cursor; Load more is available
only after that request completes and uses the cursor returned for that filter.
