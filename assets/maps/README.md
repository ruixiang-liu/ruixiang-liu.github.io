# World basemap

`world.svg` is a static, marker-free basemap made from real geographic land polygons, not an illustration. It contains 127 land polygons, including Antarctica, at Natural Earth's 1:110 million scale. Country boundaries are deliberately omitted.

## Source and license

- Data: [Natural Earth land polygons, 1:110m](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson)
- Raw download: <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson>
- Retrieved: November 11, 2026
- Source SHA-256: `9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`
- License: **public domain**, as stated in [Natural Earth's terms of use](https://www.naturalearthdata.com/about/terms-of-use/). Attribution is optional; “Made with Natural Earth” is retained in the SVG comment.

The SVG was derived directly from the GeoJSON rings. Coordinates were projected linearly and rounded to two decimal places. The source is already split at the antimeridian; Antarctica's edge along the South Pole closes across the bottom of the SVG. No simplifying or smoothing was applied.

## Projection and marker placement

- Projection: equirectangular (Plate Carree), centered at longitude 0.
- SVG view box: `0 0 960 480` (2:1 aspect ratio).
- Extent: longitude -180 to +180; latitude +90 to -90.
- Exact coordinate mapping, for decimal-degree longitude `lon` and latitude `lat`:

```js
const x = (lon + 180) * (960 / 360);
const y = (90 - lat) * (480 / 180);
```

For a percentage-positioned overlay with the same 2:1 image box:

```js
const left = ((lon + 180) / 360) * 100;
const top = ((90 - lat) / 180) * 100;
```

Keep the map and overlay in the same unpadded 2:1 coordinate area. Use the longitude and latitude provided by the visitor data; no marker positions are embedded in this asset. Background is transparent. Land fill is `#dce5e3` and coastline stroke is `#faf9f6`.
