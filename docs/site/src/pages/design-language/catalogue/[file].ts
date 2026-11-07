import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { APIRoute } from "astro";

// The catalogue and its example pages ship as plain HTML beside tokens.css in
// host-config, so the site serves those files unchanged at /design-language/catalogue/.
const folder = resolve(process.cwd(), "../../host-config/design-language");
const types: Record<string, string> = {
  "components.html": "text/html",
  "reference.html": "text/html",
  "docs.html": "text/html",
  "product.html": "text/html",
  "tokens.css": "text/css",
};
// The Markdown specs and decisions render on GitHub, where heading anchors match the catalogue's links.
const markdownBase =
  "https://github.com/filipgutica/filip-stack/blob/main/host-config/design-language/";

export const getStaticPaths = () =>
  Object.keys(types).map((file) => ({ params: { file } }));

export const GET: APIRoute = ({ params }) => {
  const file = params.file as string;
  const body = readFileSync(resolve(folder, file), "utf8").replace(
    /href="((?:components|decisions)\.md)/g,
    `href="${markdownBase}$1`,
  );
  return new Response(body, {
    headers: { "Content-Type": `${types[file]}; charset=utf-8` },
  });
};
