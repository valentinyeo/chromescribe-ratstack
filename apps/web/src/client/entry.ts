import { Runtime } from "foldkit";

import "../reset.css";
import { view } from "../view.js";
import { ModelSchema } from "./model.js";
import { TranscriptRpc } from "./rpc.js";
import { init, update } from "./update.js";

const application = Runtime.makeApplication({
  Model: ModelSchema,
  container: document.querySelector("#root"),
  init,
  update,
  view,
  resources: TranscriptRpc.layer,
});

Runtime.hydrate(application);
