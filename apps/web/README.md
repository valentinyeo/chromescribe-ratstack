# ChromeScribe preview

The Foldkit browser reads the merged transcript contracts through `/rpc`. The Website forwards RPC, API and report requests through its private `RPC_BACKEND` binding. Existing ingestion remains the only writer.

## Screens

- `/` and `/index.html` open the library. `q` searches titles/channels; `channel` restricts the results. Lists load 60 rows at a time. Search uses the backend's bounded search result. Category chips filter loaded results, not the entire database; Load more remains available.
- `/transcript?id=123` and `/transcript.html?id=123` open the viewer. YouTube timestamps seek the embedded player. TikTok and X get their own embeds. Articles use a single full-width reader. Markdown is rendered as escaped Foldkit nodes, never injected HTML. The small renderer supports headings, lists, paragraphs, code, emphasis, links and timestamps; tables and other extended Markdown remain readable text.
- The theme toggle saves `cs-theme` when browser storage permits it. `j`/`k` focus cards, Enter opens them, and `/` focuses search. Shortcuts leave text fields alone.
- Every route starts with the same server-rendered loading shell. Browser Commands read the URL and saved theme only after hydration. Data and private content are never prerendered.

## Preview workflow

`.github/workflows/deploy-preview.yml` is code-only setup. This PR does not deploy.

Before enabling it, the owner must approve deployment and:

1. Confirm Cloudflare Access already protects `next.chromescribe.yeoux.net`, including the intended preview audience. This workflow never changes Access policies.
2. Create the GitHub environment `chromescribe-preview` with required owner review. Review each run's uploaded plan before approving that environment. Do not enable this workflow without that protection.
3. Set repository secrets `CLOUDFLARE_API_TOKEN` and `ACCESS_AUD`, and repository variable `CLOUDFLARE_ACCOUNT_ID` for the reviewed account. Credentials are imported through stdin into the named `chromescribe-preview` Alchemy profile and removed from the hosted runner afterward.
4. Set repository variable `CHROMESCRIBE_PREVIEW_DEPLOY_ENABLED=true` after that approval. Without the token, approval switch, account or audience, pushes and dispatches skip with a notice rather than failing.

An enabled run checks the revision through Turbo, publishes its preview plan, then waits at the protected environment before applying. Both jobs run only on GitHub-hosted `ubuntu-latest`. The stage is always `preview`, the API gate is on, and the only Website custom domain is `next.chromescribe.yeoux.net`. The production hostname is untouched. Shared D1/R2 resources remain adopted and retained, with no migration provider.
