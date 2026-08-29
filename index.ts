import * as cheerio from "cheerio";
import { writeFileSync } from "fs";

async function fetchAssets(page: number = 1) {
  const url = `https://kenney.nl/assets/page:${page}?sort=name`;
  const html = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    },
  }).then((res) => res.text());
  const $ = cheerio.load(html);
  const assets = $("div.col-md-3 div.asset");

  return assets
    .map((i, el) => {
      const $el = $(el);
      const cover = $el
        .find("div.cover")
        .css("background-image")
        ?.replace('url("', "")
        .replace('")', "");
      const title = $el.find("h2");
      const url = $el.find("h2 a").attr("href");
      if (!url) return null;
      const slug = new URL(url).pathname.split("/").pop();
      const tags = $el.find("span.bold");
      const [category, series] = [
        tags.find('a[href*="category:"]').text() || null,
        tags.find('a[href*="series:"]').text() || null,
      ];
      return { cover: cover, title: title.find("a").text(), series, category, url, slug };
    })
    .filter(Boolean)
    .get();
}

async function fetchAllPages() {
  let page = 1;
  const assets: KenneyAssetPreview[] = [];
  while (true) {
    const fetchedAssets = await fetchAssets(page);
    if (fetchedAssets.length === 0) break;
    assets.push(...fetchedAssets);
    console.log(`Found ${assets.length} assets on page ${page}`);
    page++;
  }
  return assets;
}

async function fetchAssetPage(url: string) {
  const html = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    },
  }).then((res) => res.text());
  const $ = cheerio.load(html);
  const main = $("#content section:first");

  const title = main.find("h1").text();
  const metaHtml = main.find("table:first tbody");
  const meta: Record<string, unknown> = {};
  const rawMeta: Record<string, string> = {};
  metaHtml.find("tr").each((i, el) => {
    const $el = $(el);
    const key = $el.find("td:first").text();
    switch (key) {
      case "Tags":
        meta[key] = $el
          .find("a.tag")
          .map((i, el) => $(el).text())
          .get();
        break;

      case "Category":
        meta["Category"] = $el.find("a[href*='category:']").text();
        meta["Series"] = $el.find("a[href*='series:']").text();
        break;

      case "Features":
        meta[key] = $el
          .find("td:last")
          .find("span.feature")
          .map((i, el) => $(el).text())
          .get();
        break;

      case "Files":
        meta[key] = Number($el.find("td:last").text().replace("×", ""));
        break;

      default:
        meta[key] = $el.find("td:last").text();
        break;
    }
    rawMeta[key] = $el.find("td:last").html() ?? "";
  });

  const images = main
    .find(".col-md-6.text-right img")
    .map((i, el) => $(el).attr("src"))
    .get();

  const updatesHtml = main.find("table:last tbody");
  const updates: {
    name: string;
    description: string;
    date: Date | null;
  }[] = [];

  updatesHtml.find("tr").each((i, el) => {
    const $el = $(el);
    const dateStr = ($el.find("td").attr("title") ?? "").split("/").reverse().join("-");
    updates.push({
      name: $el.find("td span:first").text(),
      description: $el.find("td span:last").text(),
      date: dateStr ? new Date(dateStr) : null,
    });
  });

  const slug = new URL(url).pathname.split("/").pop();

  updates.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));

  const downloadUrl = $("a#donate-text").attr("href");

  const createdAt = updates[0]?.date ?? null;
  const updatedAt = updates[updates.length - 1]?.date ?? null;
  const version = updates[updates.length - 1]?.name ?? null;
  const _extracted = {
    createdAt,
    updatedAt,
    version,
  };

  return {
    title,
    meta,
    updates,
    _extracted,
    _raw_meta: rawMeta,
    slug,
    images,
    download_url: downloadUrl,
  };
}

type KenneyAssetPreview = Awaited<ReturnType<typeof fetchAssets>>[number];
type KenneyAsset = Awaited<ReturnType<typeof fetchAssetPage>>;

async function main() {
  const previews = await fetchAllPages().then((data) => {
    writeFileSync("data/assets-previews.json", JSON.stringify(data));
    return data;
  });

  const allAssets: KenneyAsset[] = [];

  for (const preview of previews) {
    const asset = await fetchAssetPage(preview.url);
    const targetPath = `data/full/${asset.slug}.json`;
    writeFileSync(targetPath, JSON.stringify(asset));
    allAssets.push(asset);
  }

  allAssets.sort(
    (a, b) =>
      (b._extracted.updatedAt?.getTime() ?? 0) - (a._extracted.updatedAt?.getTime() ?? 0),
  );

  writeFileSync("data/all.json", JSON.stringify(allAssets));
}

main();
