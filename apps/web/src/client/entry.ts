import { Runtime } from "foldkit";

import { HomeModelSchema, initialHome } from "../model.js";
import { view } from "../view.js";

const application = Runtime.makeApplication({
  Model: HomeModelSchema,
  container: document.querySelector("#root"),
  init: () => ({ model: initialHome }),
  update: (model) => ({ model }),
  view,
});

Runtime.hydrate(application);
