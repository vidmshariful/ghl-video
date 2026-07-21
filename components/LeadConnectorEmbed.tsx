/*
 * A live LeadConnector embed (calendar group, calendar, or form) inside
 * the site's frame language. The widget's own script resizes the iframe
 * to its content via postMessage; minHeight keeps the slot from
 * collapsing before that script runs. The widget content is styled by
 * HighLevel, so it arrives on its own background: the hairline frame
 * and rounded corners keep it sitting inside our grid instead of
 * floating on the canvas.
 */
export function LeadConnectorEmbed({
  src,
  embedId,
  title,
  minHeight = "42rem",
}: {
  src: string;
  embedId: string;
  title: string;
  minHeight?: string;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-hair bg-surface">
      <iframe
        src={src}
        title={title}
        id={embedId}
        scrolling="no"
        className="block w-full border-0"
        style={{ minHeight, overflow: "hidden" }}
      />
      {/* LeadConnector's resizer: sizes every LC iframe on the page */}
      <script src="https://link.msgsndr.com/js/form_embed.js" async />
    </div>
  );
}
