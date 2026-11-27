import { Schema } from "effect";

export const HomeModelSchema = Schema.Struct({
  title: Schema.String,
});

export type HomeModel = typeof HomeModelSchema.Type;

export const initialHome: HomeModel = {
  title: "ChromeScribe",
};
