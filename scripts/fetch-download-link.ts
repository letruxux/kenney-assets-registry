const assetPageUrl = process.argv.at(-1);
if (!assetPageUrl) throw new Error("Provide an asset url");

const url = new URL(assetPageUrl);

const html = await fetch(url).then((res) => res.text());

const match = html.match(/data-download-id=['"]([^'"]+)['"]/);
const downloadId = match?.[1] ?? null;

fetch("https://kenney.nl/download-link/" + downloadId, {
  headers: {
    accept: "*/*",
    "cache-control": "no-cache",
    pragma: "no-cache",
    priority: "u=1, i",
    Referer: assetPageUrl,
  },
  body: null,
  method: "GET",
})
  .then((e) => e.json())
  .then((e) => console.log((e as any).url));
