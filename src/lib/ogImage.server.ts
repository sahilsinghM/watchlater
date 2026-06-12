import satori from "satori";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import React from "react";
import type { OgCard } from "./ogCard";

// WASM and font bytes are fetched once per function instance.
let wasmReady = false;
let fontCache: { jakartaBold: ArrayBuffer; inter: ArrayBuffer } | null = null;

async function ensureReady() {
  const [fonts] = await Promise.all([
    fontCache
      ? Promise.resolve(fontCache)
      : Promise.all([
          fetch(
            "https://fonts.gstatic.com/s/plusjakartasans/v8/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff",
          ).then((r) => r.arrayBuffer()),
          fetch(
            "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff",
          ).then((r) => r.arrayBuffer()),
        ]).then(([jakartaBold, inter]) => {
          fontCache = { jakartaBold, inter };
          return fontCache;
        }),
    wasmReady
      ? Promise.resolve()
      : initWasm(fetch("https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm")).then(
          () => {
            wasmReady = true;
          },
        ),
  ]);
  return fonts;
}

export async function renderOgImage(card: OgCard): Promise<Uint8Array> {
  const fonts = await ensureReady();

  const layout = React.createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "48px 56px",
        backgroundColor: "#faf9f5",
        fontFamily: "Inter, sans-serif",
      },
    },
    React.createElement(
      "div",
      { style: { display: "flex", alignItems: "center" } },
      React.createElement(
        "span",
        {
          style: {
            fontFamily: "Plus Jakarta Sans",
            fontWeight: 800,
            fontSize: 22,
            color: "#22213a",
            letterSpacing: "-0.02em",
          },
        },
        "WatchLater",
      ),
      card.scoreText
        ? React.createElement(
            "span",
            { style: { marginLeft: "auto", fontSize: 18, fontWeight: 700, color: "#2463eb" } },
            card.scoreText,
          )
        : null,
    ),
    React.createElement(
      "div",
      {
        style: {
          flex: 1,
          display: "flex",
          alignItems: "center",
          paddingTop: 24,
          paddingBottom: 24,
        },
      },
      React.createElement(
        "span",
        {
          style: {
            fontFamily: "Plus Jakarta Sans",
            fontWeight: 800,
            fontSize: card.isFallback ? 48 : 40,
            color: "#22213a",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          },
        },
        card.title,
      ),
    ),
    React.createElement(
      "div",
      { style: { fontSize: 20, color: "#6b7280", fontWeight: 500 } },
      card.channel ?? "Learn any video in 5 minutes.",
    ),
  );

  const svg = await satori(layout, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Plus Jakarta Sans", data: fonts.jakartaBold, weight: 800, style: "normal" },
      { name: "Inter", data: fonts.inter, weight: 500, style: "normal" },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  return new Uint8Array(resvg.render().asPng());
}
