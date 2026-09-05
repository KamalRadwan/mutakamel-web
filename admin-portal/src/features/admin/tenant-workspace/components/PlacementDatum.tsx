/**
 * One label/value row inside a placement summary list.
 *
 * `mono` values are identifiers, revisions and byte counts: they are wrapped in
 * `<bdi dir="ltr">` so an Arabic RTL page does not reorder a UUID's segments
 * around the reader.
 */
export function PlacementDatum({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          mono
            ? "break-all font-mono font-medium text-foreground sm:text-end"
            : "break-words font-medium text-foreground sm:text-end"
        }
      >
        {mono ? <bdi dir="ltr">{value}</bdi> : value}
      </dd>
    </div>
  );
}
