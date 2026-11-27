import { toHttpApi } from "@chromescribe/capability";
import { healthFor } from "@chromescribe/core";

export const health = healthFor("cloudflare-worker");

export const capabilities = [health] as const;

export const http = toHttpApi("ChromeScribeWorker", capabilities);
