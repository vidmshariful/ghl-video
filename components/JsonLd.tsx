/*
 * Server component that emits JSON-LD into the static HTML. One or more
 * schema objects render as a single script: a lone object directly, a
 * list under @graph. The "<" escape stops any string value from closing
 * the <script> tag early.
 */
export function JsonLd({ schema }: { schema: object[] }) {
  const payload =
    schema.length === 1
      ? { "@context": "https://schema.org", ...schema[0] }
      : { "@context": "https://schema.org", "@graph": schema };
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
