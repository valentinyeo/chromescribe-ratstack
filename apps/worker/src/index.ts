import { server } from "./app.js";

export default {
  fetch: (request: Request) => server.handler(request),
};
