import type { APIRoute } from "astro";

// The catalogue and its example pages moved to the design system's site. These
// pages keep old links working; the script carries any #fragment across.
const designSystemSite = "https://filipgutica.github.io/design-system/";
const files = ["components.html", "reference.html", "docs.html", "product.html"];

export const getStaticPaths = () => files.map((file) => ({ params: { file } }));

export const GET: APIRoute = ({ params }) => {
  const target = `${designSystemSite}${params.file}`;
  const body = `<!doctype html>
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
  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};
