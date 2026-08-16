import { notFound } from "next/navigation";

/*
 * The kit's production guard. Call it FIRST in the layout and in every page.
 *
 * Calling it in the layout alone is not enough, and this was measured rather
 * than guessed: a layout and its page render in parallel, so the layout
 * throwing notFound() does not stop the page component from running. The
 * build still produced a 404 status for /uikits, but the response body
 * carried the whole kit page inside its RSC flight payload. Guarding each
 * page component makes it throw before it returns any JSX, so there is no
 * rendered output to embed.
 *
 * What this does NOT do: remove the kit from the deployment. The route's
 * JavaScript chunks are still built and uploaded, they are just unreachable
 * and render nothing. Excluding the files from the bundle needs a build-time
 * step, which is not wired up.
 */
export function assertDevOnly() {
  if (process.env.NODE_ENV === "production") notFound();
}
