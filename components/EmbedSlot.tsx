import { Panel } from "@/components/Panel";

/*
 * Designed placeholder for a LeadConnector embed (booking calendar,
 * form). Renders a bounded cell with a mono label so the layout is
 * final; the real embed code drops inside with no layout change.
 * PLACEHOLDER: flagged for Shariful to supply the embed snippets.
 */
export function EmbedSlot({
  label,
  note,
  minH = "min-h-[28rem]",
}: {
  label: string;
  note: string;
  minH?: string;
}) {
  return (
    <Panel className={`flex ${minH} items-center justify-center overflow-hidden`}>
      <div className="px-8 py-16 text-center">
        <p className="inline-flex items-center gap-3 rounded-full border border-hair bg-surface px-4 py-2 font-mono text-label uppercase">
          <span className="text-dim">
            [ <span className="text-gold">LeadConnector</span> ]
          </span>
          <span className="text-muted">{label}</span>
        </p>
        <p className="mx-auto mt-4 max-w-[36ch] text-body text-dim">{note}</p>
      </div>
    </Panel>
  );
}
