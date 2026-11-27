import { Runtime } from "foldkit";

import "../reset.css";
import { view } from "../view.js";
import { Model } from "./model.js";
import { TranscriptRpc } from "./rpc.js";
import { init, update } from "./update.js";

const application = Runtime.makeApplication({
  Model,
  container: document.querySelector("#root"),
  init,
  update,
  view,
  resources: TranscriptRpc.layer,
});

Runtime.hydrate(application);
