/*
 * The heading every sales-page section opens with.
 *
 * Eyebrow, a two-tone headline, and an optional lede, at one measure and one
 * rhythm. Lifted out of the white-label page when the editing landing page
 * was built beside it: that page had hand-rolled its own eyebrow and h2 in
 * every section and the result read as a different page every time you
 * scrolled. One head, so every LP has the same spine.
 */
export function SectionHead({
  eyebrow,
  title,
  accent,
  sub,
  center,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  sub?: string;
  center?: boolean;
}) {
  return (
    <div
      style={{
        maxWidth: center ? "46rem" : "42rem",
        marginInline: center ? "auto" : undefined,
        textAlign: center ? "center" : "left",
      }}
    >
      <span className="sp-eyebrow">{eyebrow}</span>
      <h2 className="sp-display sp-h2" style={{ marginTop: "0.7rem" }}>
        {title}
        {accent ? (
          <>
            {" "}
            <span className="sp-grad-text">{accent}</span>
          </>
        ) : null}
      </h2>
      {sub ? (
        <p className="sp-lede" style={{ marginTop: "0.9rem" }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}
