import * as stylex from "@stylexjs/stylex";
import type { Document, HtmlBuilder } from "foldkit/html";

import type { HomeModel } from "./model.js";

const style = stylex.create({
  shell: {
    backgroundColor: "#181825",
    color: "#cdd6f4",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    margin: 0,
    minHeight: "100vh",
    padding: "4rem 1.5rem",
  },
  subtitle: {
    color: "#a6adc8",
    fontSize: "1rem",
    marginTop: "0.75rem",
  },
  title: {
    color: "#ff1493",
    fontSize: "2.5rem",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    margin: 0,
  },
});

const className = (rule: stylex.StyleXStyles) =>
  stylex.props(rule).className ?? "";

export const view = (home: HomeModel, h: HtmlBuilder<never>): Document => ({
  body: h.main(
    [h.Attribute("class", className(style.shell))],
    [
      h.h1([h.Attribute("class", className(style.title))], [home.title]),
      h.p(
        [h.Attribute("class", className(style.subtitle))],
        ["Transcribes your browsing into a searchable record."]
      ),
    ]
  ),
  title: home.title,
});
