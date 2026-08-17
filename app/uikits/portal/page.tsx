import { assertDevOnly } from "@/components/uikits/dev-only";
import { PortalKitClient } from "./PortalKitClient";

/*
 * The guard has to stay in a SERVER component, which is why the body lives
 * next door. Specimens need real handlers (a chart formats its own numbers, a
 * tab switches), and functions cannot cross into a client component from a
 * server one. Making this page client instead would have worked, and would
 * have moved the dev-only check into a file that also ships to the browser.
 */
export default function PortalKitPage() {
  assertDevOnly();
  return <PortalKitClient />;
}
