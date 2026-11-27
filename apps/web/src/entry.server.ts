import { Effect } from "effect";
import {
  renderDocument,
  Rendered,
  renderToString,
} from "foldkit/experimental/server";
import type {
  DocumentRenderer,
  EntryResult,
} from "foldkit/experimental/server";

import { initialModel } from "./client/model.js";
import { view } from "./view.js";

export const prerenderPaths = ["/"];

const application = {
  init: () => ({ model: initialModel }),
  view,
};

export const renderReaderPage = Effect.fn("web.renderPage")(
  function* renderReaderPage(request: Request) {
    const rendered = yield* renderToString(application, {
      runtimeId: new URL(request.url).pathname,
    });

    return Rendered(rendered, { status: 200 });
  }
);

export const renderPage = (request: Request): Promise<EntryResult> =>
  Effect.runPromise(renderReaderPage(request));

export const renderDocumentHtml: DocumentRenderer = (rendered, assets) =>
  renderDocument(rendered, assets);

export { renderDocumentHtml as renderDocument };
