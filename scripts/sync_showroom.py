#!/usr/bin/env python3
"""Generate the Doctor Portal's showroom content from this repo's tour.json.

content/tour.json is the single place the public Explore/showroom content is
authored. Two surfaces render it — this site and the Doctor Portal's /explore —
and they used to hold the same tracks, order, screenshots and localized copy in
two different formats, kept in step by hand.

This script removes that duplicate authoring. It reads content/tour.json plus
assets/img/tour/, and writes into the Doctor Portal:

  lib/features/showroom/domain/showroom_content.g.dart   (generated, never edited)
  assets/showroom/*.png                                  (copied, byte-identical)

WHAT IT OWNS
    Track publication, step order, screenshot references and the localized step
    titles and descriptions — the things that are genuinely the same on both
    surfaces.

WHAT IT DOES NOT OWN
    The portal's showroom UI, selector behaviour, lightbox, keyboard handling,
    RTL implementation, CTA routing, chip labels, hero and CTA copy. Those are
    presentation, they differ between the two surfaces on purpose, and they stay
    ordinary Doctor Portal code.

USAGE
    python scripts/sync_showroom.py            # regenerate
    python scripts/sync_showroom.py --check    # verify, change nothing (CI)

The no-placeholder rule is preserved: a step with "image": null is skipped, and
a track with no published steps is not emitted at all — which is exactly how
Laboratory stays off both surfaces until its real captures exist.
"""
import argparse
import filecmp
import hashlib
import io
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)

TOUR_JSON = os.path.join(SITE, 'content', 'tour.json')
TOUR_IMAGES = os.path.join(SITE, 'assets', 'img', 'tour')

# Sibling checkout by default; --portal overrides. Never an absolute path.
DEFAULT_PORTAL = os.path.normpath(os.path.join(SITE, '..', 'doctor_portal'))

GENERATED_DART = os.path.join(
    'lib', 'features', 'showroom', 'domain', 'showroom_content.g.dart')
PORTAL_ASSETS = os.path.join('assets', 'showroom')
PORTAL_ASSET_PREFIX = 'assets/showroom'

LOCALES = ('en', 'ar', 'ku')


class ContentError(Exception):
    """Something in the canonical content is wrong. Never guessed around."""


def dart_string(value):
    """A Dart single-quoted literal. Escapes what Dart cares about."""
    out = (value.replace('\\', '\\\\')
                .replace("'", "\\'")
                .replace('$', '\\$')
                .replace('\r', '')
                .replace('\n', '\\n'))
    return "'" + out + "'"


def localized(node, where):
    """A {en, ar, ku} map, all three present and non-empty."""
    if not isinstance(node, dict):
        raise ContentError('%s is not a localized object' % where)
    out = {}
    for code in LOCALES:
        value = node.get(code)
        if not isinstance(value, str) or not value.strip():
            raise ContentError('%s is missing %s text' % (where, code))
        out[code] = value.strip()
    return out


def read_tracks():
    """Published tracks and steps, validated. Raises rather than inventing."""
    with io.open(TOUR_JSON, encoding='utf-8') as f:
        data = json.load(f)

    tracks = []
    seen_tracks = set()

    for track in data.get('tracks', []):
        track_id = track.get('id')
        if not track_id:
            raise ContentError('a track has no id')
        if track_id in seen_tracks:
            raise ContentError('duplicate track id: %s' % track_id)
        seen_tracks.add(track_id)

        steps = []
        seen_steps = set()
        for step in track.get('steps', []):
            step_id = step.get('id')
            if not step_id:
                raise ContentError('%s has a step with no id' % track_id)
            if step_id in seen_steps:
                raise ContentError(
                    'duplicate step id in %s: %s' % (track_id, step_id))
            seen_steps.add(step_id)

            image = step.get('image')
            if not image:
                # Planned, not approved. The no-placeholder rule: skip it.
                continue

            source = os.path.join(TOUR_IMAGES, image)
            if not os.path.exists(source):
                raise ContentError(
                    '%s/%s references %s, which is not in assets/img/tour/'
                    % (track_id, step_id, image))

            steps.append({
                'id': step_id,
                'image': image,
                'title': localized(step.get('title'),
                                   '%s/%s title' % (track_id, step_id)),
                'text': localized(step.get('text'),
                                  '%s/%s text' % (track_id, step_id)),
            })

        if steps:
            tracks.append({'id': track_id, 'steps': steps})

    if not tracks:
        raise ContentError('no track has any approved screenshot')
    return tracks


def render_dart(tracks):
    out = []
    w = out.append

    w('// GENERATED FILE — DO NOT EDIT BY HAND.')
    w('//')
    w('// Written by trustydr-main-site/scripts/sync_showroom.py from that')
    w("// repo's content/tour.json, which is where this content is authored.")
    w('// Editing this file directly is lost on the next run; edit tour.json')
    w('// and re-run the generator instead.')
    w('//')
    w('// It carries ONLY what both public surfaces genuinely share: which')
    w('// tracks are published, the order of their steps, which screenshot')
    w('// each step shows, and the localized title and description. The chip')
    w('// labels, hero copy, CTA wording and every part of the presentation')
    w('// are ordinary Doctor Portal code and are not touched from here.')
    w('//')
    w('// A step whose image is null in tour.json is skipped, and a track with')
    w('// no published steps is not emitted — which is how Laboratory stays')
    w('// off the page until its real captures exist.')
    w('')
    w("import 'package:doctor_portal/features/showroom/domain/showroom_step.dart';")
    w('')
    w('/// Published track ids, in the order their chips appear.')
    w('const List<String> kGeneratedPublishedTrackIds = <String>[')
    for track in tracks:
        w('  %s,' % dart_string(track['id']))
    w('];')
    w('')
    w('/// The published steps of each track, in tour order.')
    w('const Map<String, List<ShowroomStep>> kGeneratedShowroomSteps =')
    w('    <String, List<ShowroomStep>>{')
    for track in tracks:
        w('  %s: <ShowroomStep>[' % dart_string(track['id']))
        for step in track['steps']:
            w('    ShowroomStep(')
            w('      id: %s,' % dart_string(step['id']))
            w('      asset: %s,'
              % dart_string('%s/%s' % (PORTAL_ASSET_PREFIX, step['image'])))
            w('      title: <String, String>{')
            for code in LOCALES:
                w('        %s: %s,'
                  % (dart_string(code), dart_string(step['title'][code])))
            w('      },')
            w('      text: <String, String>{')
            for code in LOCALES:
                w('        %s: %s,'
                  % (dart_string(code), dart_string(step['text'][code])))
            w('      },')
            w('    ),')
        w('  ],')
    w('};')
    w('')
    return '\n'.join(out)


def sync_assets(tracks, portal, check):
    """Copy referenced captures across; report anything that would change."""
    target_dir = os.path.join(portal, PORTAL_ASSETS)
    if not os.path.isdir(target_dir) and not check:
        os.makedirs(target_dir)

    wanted = {s['image'] for t in tracks for s in t['steps']}
    changes = []

    for name in sorted(wanted):
        source = os.path.join(TOUR_IMAGES, name)
        target = os.path.join(target_dir, name)
        same = os.path.exists(target) and filecmp.cmp(source, target, shallow=False)
        if same:
            continue
        changes.append(('copy', name))
        if not check:
            shutil.copy2(source, target)

    # Only ever removes files from the portal's showroom folder, which exists
    # solely for these captures. Nothing outside it is touched.
    if os.path.isdir(target_dir):
        for name in sorted(os.listdir(target_dir)):
            if not name.lower().endswith('.png'):
                continue
            if name in wanted:
                continue
            changes.append(('remove', name))
            if not check:
                os.remove(os.path.join(target_dir, name))

    return changes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--portal', default=DEFAULT_PORTAL,
                        help='path to the doctor_portal checkout')
    parser.add_argument('--check', action='store_true',
                        help='verify only; change nothing and exit 1 on drift')
    args = parser.parse_args()

    portal = os.path.abspath(args.portal)
    if not os.path.isdir(os.path.join(portal, 'lib', 'features', 'showroom')):
        print('not a doctor_portal checkout: %s' % portal, file=sys.stderr)
        return 2

    try:
        tracks = read_tracks()
    except ContentError as e:
        print('content error: %s' % e, file=sys.stderr)
        return 2

    dart_path = os.path.join(portal, GENERATED_DART)
    rendered = render_dart(tracks)

    existing = None
    if os.path.exists(dart_path):
        with io.open(dart_path, encoding='utf-8') as f:
            existing = f.read()

    dart_changed = existing != rendered
    if dart_changed and not args.check:
        with io.open(dart_path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(rendered)

    asset_changes = sync_assets(tracks, portal, args.check)

    for track in tracks:
        print('  %-11s %d published step(s)' % (track['id'], len(track['steps'])))
    for action, name in asset_changes:
        print('  %-6s %s' % (action, name))

    drift = dart_changed or bool(asset_changes)

    if args.check:
        if drift:
            print('\nOUT OF SYNC — run: python scripts/sync_showroom.py',
                  file=sys.stderr)
            if dart_changed:
                print('  %s differs' % GENERATED_DART, file=sys.stderr)
            return 1
        print('\nIN SYNC — the Doctor Portal matches content/tour.json')
        return 0

    print('\n%s' % ('regenerated' if drift else 'already up to date'))
    print('next: cd %s && flutter analyze && flutter test test/showroom_tracks_test.dart'
          % os.path.relpath(portal, os.getcwd()).replace('\\', '/'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
