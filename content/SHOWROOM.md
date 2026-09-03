# Showroom / Explore content

`content/tour.json` is the **single place** the public Explore content is
authored. Two surfaces render it:

- this site — `en|ar|ku/explore/`
- the Doctor Portal — `/explore`

Both are static and bundled. There is no CMS, no runtime fetch, and no network
dependency: changing content means editing here and rebuilding.

## Changing anything

Replace a screenshot, add or remove a step, reorder, reword a title, publish
Laboratory — all the same three moves:

```bash
# 1. edit the canonical content
#      content/tour.json                  (tracks, order, titles, descriptions)
#      assets/img/tour/<file>.png         (the captures themselves)

# 2. regenerate both surfaces
python scripts/build_explore.py       # rebuilds en|ar|ku/explore/index.html
python scripts/sync_showroom.py       # regenerates the Doctor Portal's copy

# 3. verify
cd test && npm run test:explore && cd ..
cd ../doctor_portal && flutter test test/showroom_parity_test.dart
```

Then build and deploy each frontend as usual. They are deployed separately on
purpose; only the *authoring* is shared.

`python scripts/sync_showroom.py --check` changes nothing and exits non-zero if
the portal has drifted — the one to run in CI or before a release.

## What the generator owns

Only what both surfaces genuinely share:

| Owned by the generator | Stays hand-written portal code |
| --- | --- |
| which tracks are published | chip labels, hero and CTA copy |
| step order | layout, selector behaviour, lightbox |
| screenshot references and files | keyboard navigation, RTL implementation |
| localized titles and descriptions | CTA routing |

It writes exactly two things in `doctor_portal`:

- `lib/features/showroom/domain/showroom_content.g.dart`
- `assets/showroom/*.png` (copied byte-identical from `assets/img/tour/`)

It never touches `assets/l10n/`, the showroom UI, or anything else.

## The no-placeholder rule

A step with `"image": null` is **planned, not published**. The generator skips
it, and a track with no published steps is not emitted at all — no tab, no
panel, no "coming soon".

This is how Laboratory stays off both surfaces today. Its steps already exist in
`tour.json` with `image: null`, and the portal already carries its chip label,
hero and CTA copy. **Publishing it is content-only**: drop the approved captures
into `assets/img/tour/`, set their filenames in `tour.json`, run the two
scripts. No Dart change, no redesign.

## If the generator refuses

It fails loudly rather than guessing:

- a step references an image that is not in `assets/img/tour/`
- a title or description is missing `en`, `ar` or `ku`
- two tracks or two steps share an id

Fix the content and re-run. It is idempotent — running it twice produces no
second diff.
