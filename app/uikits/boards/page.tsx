import { BoardsClient } from "./BoardsClient";
import { assertDevOnly } from "@/components/uikits/dev-only";

/* Server shell: the guard has to run in the page component, not only in the
 * layout, or the 404 still ships the rendered board UI in its RSC payload. */
export default function BoardsPage() {
  assertDevOnly();
  return <BoardsClient />;
}
