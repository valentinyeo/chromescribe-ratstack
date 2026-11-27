export interface WebsiteBindings {
  readonly RPC_BACKEND: {
    readonly fetch: (request: Request) => Promise<Response>;
  };
}

export const routeWebsiteRequest = (
  request: Request,
  bindings: WebsiteBindings,
  render: (request: Request) => Promise<Response>
) => {
  const path = new URL(request.url).pathname;
  if (path === "/rpc" || path.startsWith("/api/") || path.startsWith("/reports/")) {
    return bindings.RPC_BACKEND.fetch(request);
  }
  return render(request);
};
