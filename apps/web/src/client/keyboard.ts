import { Effect, Queue, Stream } from "effect";
import { Mount } from "foldkit";

import { Messages } from "./messages.js";

export const LibraryKeyboard = Mount.defineStream("LibraryKeyboard", {
  messages: [Messages.CompletedAction],
  execute: ({ element }) =>
    Stream.callback<typeof Messages.CompletedAction.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const owner = element.ownerDocument;

          const handle = (event: KeyboardEvent) => {
            if (
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              owner.activeElement?.closest(
                "input, textarea, select, [contenteditable=true]"
              )
            ) {
              return;
            }

            const search =
              element.querySelector<HTMLInputElement>("#library-search");

            if (event.key === "/" && search) {
              event.preventDefault();
              search.focus();
              Queue.offerUnsafe(
                queue,
                Messages.CompletedAction({ notice: "Search focused." })
              );

              return;
            }

            if (event.key !== "j" && event.key !== "k") {
              return;
            }

            const cards = [
              ...element.querySelectorAll<HTMLAnchorElement>(
                "[data-transcript-card]"
              ),
            ];

            if (!cards.length) {
              return;
            }

            const current = cards.findIndex((card) =>
              card.contains(owner.activeElement)
            );

            const step = event.key === "j" ? 1 : -1;
            const initial = event.key === "j" ? 0 : cards.length - 1;

            const index =
              current === -1
                ? initial
                : (current + step + cards.length) % cards.length;

            event.preventDefault();
            cards[index]?.focus();
            Queue.offerUnsafe(
              queue,
              Messages.CompletedAction({
                notice: "Press Enter to open the selected transcript.",
              })
            );
          };

          owner.addEventListener("keydown", handle);

          return () => {
            owner.removeEventListener("keydown", handle);
          };
        }),
        (release) => Effect.sync(release)
      ).pipe(Effect.andThen(Effect.never))
    ),
});
