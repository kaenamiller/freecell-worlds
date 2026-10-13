# Agent notes

## Image generation

Use **Nano Banana 2.1** for every image in this repo. The model id is `gemini-nano-banana-2.1`.

- Leave that id as the default in the generators under `tools/`. `ART_MODEL` may override a single command; do not change the checked-in default.
- Do not switch to `gemini-3-pro-image` or any other image model unless the user names a different model for that one job.
- Chart islands, market islands, theme art, and charm icons all go through these scripts: `tools/gen-chart-art.mjs`, `tools/gen-art.mjs`, `tools/gen-charm-icons.mjs`, `tools/gen-locked-themes.mjs`, `tools/gen-icon-samples.mjs`.
