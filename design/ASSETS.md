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
