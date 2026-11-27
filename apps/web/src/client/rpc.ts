import { toRpcGroup } from "@chromescribe/capability/rpc-group";
import {
  getTranscriptAroundContract,
  getTranscriptContentContract,
  getTranscriptContract,
  listCategoriesContract,
  listTranscriptsContract,
  searchTranscriptsContract,
} from "@chromescribe/core/contracts";
import { Context, Layer } from "effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as RpcClient from "effect/rpc/RpcClient";
import type * as RpcClientError from "effect/rpc/RpcClientError";
import * as RpcSerialization from "effect/rpc/RpcSerialization";

export const transcriptRpc = toRpcGroup([
  listTranscriptsContract,
  searchTranscriptsContract,
  listCategoriesContract,
  getTranscriptContract,
  getTranscriptContentContract,
  getTranscriptAroundContract,
]);

export class TranscriptRpc extends Context.Service<
  TranscriptRpc,
  RpcClient.FromGroup<typeof transcriptRpc.group, RpcClientError.RpcClientError>
>()("web/TranscriptRpc") {
  static readonly layer = Layer.effect(
    TranscriptRpc,
    RpcClient.make(transcriptRpc.group)
  ).pipe(
    Layer.provide(
      RpcClient.layerProtocolHttp({ url: "/rpc" }).pipe(
        Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])
      )
    )
  );
}
