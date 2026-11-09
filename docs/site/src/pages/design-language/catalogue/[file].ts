import type { APIRoute } from "astro";

// The catalogue and its example pages moved to the design system's site. These
// pages keep old links working: HTML pages redirect, and the script carries any
// #fragment across. A stylesheet cannot redirect, so tokens.css imports the new one.
const designSystemSite = "https://filipgutica.github.io/design-system/";
const pages = ["components.html", "reference.html", "docs.html", "product.html"];

export const getStaticPaths = () =>
  [...pages, "tokens.css"].map((file) => ({ params: { file } }));

const redirectPage = (target: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved to the design system</title>
<link rel="canonical" href="${target}">
<meta http-equiv="refresh" content="0; url=${target}">
<script>location.replace(${JSON.stringify(target)} + location.hash)</script>
</head>
<body><p>This page moved to <a href="${target}">${target}</a>.</p></body>
</html>
`;

export const GET: APIRoute = ({ params }) => {
  const target = `${designSystemSite}${params.file}`;
  if (params.file === "tokens.css") {
    return new Response(`@import url("${target}");\n`, {
      headers: { "Content-Type": "text/css; charset=utf-8" },
    });
  }
  return new Response(redirectPage(target), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};
