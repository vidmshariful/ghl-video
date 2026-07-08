/*
 * The blueprint frame: two continuous vertical rules bounding the
 * content column for the whole page height. Sections and panels snap
 * into this visible structure, which is what keeps the page reading
 * architected rather than floating. Decorative only.
 */
export function PageFrame() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-y-0 left-1/2 z-0 w-[min(100%-1.5rem,80.5rem)] -translate-x-1/2 border-x border-hair/50"
    />
  );
}
