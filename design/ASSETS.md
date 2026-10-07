# Asset credits

Every third-party asset used in the app or the mockups. All are free to use under the Pexels License (no attribution required, credited here anyway). None show faces, logos or TMMIN premises.

| File | Source | Author | Processing |
|---|---|---|---|
| `public/landing/factory-line.*` | Pexels video 30715848 | Parker Filme | Trimmed loop, mp4 + webm, poster |
| `design/mockup/assets/video/cams/body-hall.*` | Pexels video 30715848 | Parker Filme | CCTV grade (see below) |
| `design/mockup/assets/video/cams/body-weld-a.*` | Pexels video 6450803 | Engin Altundağ | CCTV grade |
| `design/mockup/assets/video/cams/body-weld-b.*` | Pexels video 4468754 | Engin Altundağ | CCTV grade |

CCTV grade (ffmpeg): 8 s loop, 960 px wide, 15 fps, grayscale, slight contrast lift and film noise, no audio, plus a poster frame.

```
scale=960:-2,format=gray,eq=contrast=1.12:brightness=-0.03,noise=alls=6:allf=t,format=yuv420p
```

## Honesty rules for camera media

- Real clips are labelled "Test clip · no annotation". They never carry a detection box, because we have no per-frame annotation for them.
- Only our own simulated bead still carries a heatmap, labelled "simulated".
- Cameras without a clip show a procedural SVG sealer scene, labelled "Simulated scene".

Original work (bead illustrations, sealer scene, icons from Phosphor under MIT) is ours or open source. No code, assets or copy were taken from reference projects.

## Libraries and fonts in the mockups

| Item | Source | License |
|---|---|---|
| three.js 0.170 (scale model of the line) | jsDelivr CDN | MIT |
| Big Shoulders Display (landing display face) | Google Fonts | SIL Open Font License |
| Source Sans 3 | Google Fonts | SIL Open Font License |
| Phosphor Icons | unpkg CDN | MIT |
| "Autoshop 01" HDRI by Oliksiy Yakovlyev (image-based light in `landing3-real.html`) | Poly Haven CDN, loaded at runtime | CC0 |

The line model, the car bodies on skids, the andon towers, the sealer bead illustration (SVG lighting filters) and the abnormality tag are drawn from scratch. No 3D models, textures or images were downloaded for them.

## Car bodies on the line (3D)

Bodies change the way they do in a real plant: bare steel through the body stations (`body-*.glb`), painted after the paint station, and finished with glass and tyres at final inspection (`car-*.glb`, materials renamed by role: paint, glass, light, trim, tyre). Paint colours are the four achromatic car colours (white, silver, grey, black); caution yellow only marks the body waiting on a decision. The scene is lit by three.js RoomEnvironment (built in, no download).

For the bare shells, only the body shell of each model is used, as body-in-white: glass, lights, wheels, number plates, badges and interior were removed, textures dropped, and the colour is set in code from our palette (steel grey; caution yellow only for the body waiting on a decision). Processed with glTF-Transform (prune, weld, join, quantize) into `public/models/` and `design/mockup/assets/models/`, 90 to 140 KB each.

| File | Source | Author | License |
|---|---|---|---|
| `body-urban.glb`, `car-urban.glb` | "Urban '10 - Low poly model", sketchfab.com/3d-models/urban-10-low-poly-model-2866efdfa943484391ef8313768e074d | Daniel Zhabotinsky | CC BY 4.0 |
| `body-kiri.glb`, `car-kiri.glb` | "Kiri '10 - Low poly model", sketchfab.com/3d-models/kiri-10-low-poly-model-7fd6e15785fa4aa9bfd6e31eb7c97ba6 | Daniel Zhabotinsky | CC BY 4.0 |
| `body-van.glb`, `body-hatch.glb`, `car-van.glb`, `car-hatch.glb` | "Generic passenger car pack", sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5 | Comrade1280 | CC BY 4.0 |

All are fictional, unbranded designs. No model of a real Toyota product is used. The raw downloads stay out of the repository.
