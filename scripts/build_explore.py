# -*- coding: utf-8 -*-
"""Generate the public Explore TrustyDr product tour pages.

    python scripts/build_explore.py

Reads content/tour.json and writes en|ar|ku/explore/index.html.

Why a generator rather than fetch()-ing JSON at runtime: this site has no build
step and ships plain HTML, and a marketing page that only assembles itself once
JavaScript runs is a page search engines and no-JS visitors see as empty. The
generator keeps the authoring convenience of one content file while the
deployed artefact stays static. It is a dev tool, like test/ - it is not part
of the site and never runs in a browser.

The header and footer are lifted from each locale's own homepage, so the tour
cannot drift from the site chrome or ship an English nav on the Arabic page.
"""
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ('en', 'ar', 'ku')


def read(path):
    return io.open(path, encoding='utf-8').read()


def chrome(lang):
    """(head_extras, header_html, footer_html) taken from the locale homepage."""
    home = read(os.path.join(ROOT, lang, 'index.html'))

    m = re.search(r'(<a class="skip-link".*?</header>)', home, re.S)
    if not m:
        raise SystemExit('%s: could not find the header block' % lang)
    header = m.group(1)

    m = re.search(r'(<footer class="footer".*?</footer>)', home, re.S)
    if not m:
        raise SystemExit('%s: could not find the footer block' % lang)
    footer = m.group(1)

    scripts = re.findall(r'<script src="[^"]+"[^>]*></script>', home)
    return header, footer, scripts


def step_media(step, labels):
    """The screenshot, wrapped in a control that opens it full size.

    There is no placeholder branch. A step without an approved capture is
    filtered out before it reaches here (see `visible_steps`), because a
    placeholder card on a public page advertises an unfinished product - and
    fabricating the missing screen is not an alternative.
    """
    return (
        '<button type="button" class="tourShotBtn" data-tour-zoom '
        'data-tour-full="/assets/img/tour/%s" aria-label="%s: %s">\n'
        '            <img class="tourShot" src="/assets/img/tour/%s" alt="%s" '
        'loading="lazy" decoding="async">\n'
        '            <span class="tourZoomHint" aria-hidden="true">%s</span>\n'
        '          </button>'
        % (step['image'], labels['enlarge'], step['_alt'],
           step['image'], step['_alt'], labels['enlarge'])
    )


def visible_steps(track):
    """Only steps with an approved screenshot are published.

    content/tour.json keeps the planned steps so the roadmap stays in one
    place; this is the gate that stops them reaching the public page.
    """
    return [s for s in track['steps'] if s.get('image')]


def visible_tracks(data):
    """Only tracks that have something real to show.

    A platform with no captures is hidden entirely rather than published as an
    empty or "coming soon" tour: a prospective provider should never be shown a
    tour that makes the product look unfinished.
    """
    return [t for t in data['tracks'] if visible_steps(t)]


def build(lang, data):
    labels = data['labels'][lang]
    header, footer, scripts = chrome(lang)
    rtl = lang in ('ar', 'ku')
    tracks = visible_tracks(data)
    if not tracks:
        raise SystemExit(
            'Refusing to generate: no track has an approved screenshot. '
            'An Explore page with nothing real on it must not be published.')
    single = len(tracks) == 1

    tabs = '\n'.join(
        '        <button type="button" class="tourTab%s" role="tab" '
        'id="tab-%s" aria-controls="panel-%s" aria-selected="%s" '
        'data-tour-tab="%s">%s<span class="tourTabNote">%s</span></button>'
        % (' is-active' if i == 0 else '', t['id'], t['id'],
           'true' if i == 0 else 'false', t['id'],
           t['name'][lang], t['tagline'][lang])
        for i, t in enumerate(tracks))

    panels = []
    for i, t in enumerate(tracks):
        steps = []
        for n, step in enumerate(visible_steps(t), start=1):
            step = dict(step)
            step['_alt'] = '%s — %s' % (t['name'][lang], step['title'][lang])
            steps.append(
                '        <li class="tourStep">\n'
                '          <div class="tourStepHead">\n'
                '            <span class="tourStepNum">%s %d</span>\n'
                '            <h3 class="tourStepTitle">%s</h3>\n'
                '          </div>\n'
                '          <p class="tourStepText">%s</p>\n'
                '          %s\n'
                '        </li>'
                % (labels['step_of'], n, step['title'][lang],
                   step['text'][lang], step_media(step, labels)))

        panels.append(
            '      <section class="tourPanel%s" role="tabpanel" id="panel-%s" '
            'aria-labelledby="tab-%s" data-tour-panel="%s"%s>\n'
            '        <ol class="tourSteps">\n%s\n        </ol>\n'
            '        <div class="tourCta">\n'
            '          <h2 class="tourCtaTitle">%s</h2>\n'
            '          <p class="tourCtaText">%s</p>\n'
            '          <div class="tourCtaRow">\n'
            '            <a class="btn primary" href="%s" target="_blank" rel="noopener">%s</a>\n'
            '            <a class="btn ghost" href="/%s/contact/">%s</a>\n'
            '          </div>\n'
            '        </div>\n'
            '      </section>'
            % (' is-active' if i == 0 else '', t['id'], t['id'], t['id'],
               '' if (i == 0 or single) else ' hidden', '\n'.join(steps),
               labels['cta_title'], labels['cta_text'],
               t['cta_url'], labels['cta_primary'], lang, labels['cta_secondary']))

    script_tags = '\n'.join(scripts)

    return """<!doctype html>
<html lang="%(lang)s" dir="%(dir)s" data-lang="%(lang)s">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TrustyDr | %(page_title)s</title>
  <meta name="description" content="%(meta_description)s">
  <link rel="canonical" href="https://www.trustydr.com/%(lang)s/explore/">
  <meta property="og:site_name" content="TrustyDr">
  <meta property="og:title" content="TrustyDr | %(page_title)s">
  <meta property="og:description" content="%(meta_description)s">
  <meta property="og:type" content="website">
  <meta property="og:image" content="https://www.trustydr.com/assets/img/logo.png">
  <link rel="icon" href="/assets/img/logo.png">
  <link rel="stylesheet" href="/assets/css/styles.css">
  <link rel="stylesheet" href="/assets/css/explore.css">
</head>
<body>

%(header)s

<main id="main">
  <section class="section tourIntro">
    <div class="container">
      <p class="tourEyebrow">%(eyebrow)s</p>
      <h1 class="tourTitle">%(title)s</h1>
      <p class="tourLead">%(lead)s</p>
    </div>
  </section>

  <div class="container">
%(picker)s
%(panels)s
  </div>
</main>

<div class="tourLightbox" data-tour-lightbox hidden>
  <div class="tourLightboxInner" role="dialog" aria-modal="true" aria-label="%(enlarge)s">
    <button type="button" class="tourLightboxClose" data-tour-lightbox-close
            aria-label="%(close)s">&times;</button>
    <img class="tourLightboxImg" data-tour-lightbox-img src="" alt="">
    <p class="tourLightboxCaption" data-tour-lightbox-caption></p>
  </div>
</div>

%(footer)s

%(scripts)s
<script src="/assets/js/explore.js" defer></script>
</body>
</html>
""" % {
        'lang': lang,
        'dir': 'rtl' if rtl else 'ltr',
        'page_title': labels['page_title'],
        'meta_description': labels['meta_description'],
        'eyebrow': labels['eyebrow'],
        'title': labels['title'],
        'lead': labels['lead'],
        # With one track the tablist is noise, but the platform still has to
        # be named or the visitor cannot tell what they are looking at.
        'picker': (
            '    <div class="tourSingleHead">\n'
            '      <h2 class="tourSingleName" data-tour-track-name>%s</h2>\n'
            '      <p class="tourSingleNote">%s</p>\n'
            '    </div>\n'
            % (tracks[0]['name'][lang], tracks[0]['tagline'][lang])
        ) if single else (
            '    <h2 class="tourPick">%s</h2>\n'
            '    <div class="tourTabs" role="tablist" aria-label="%s">\n%s\n    </div>\n'
            % (labels['pick'], labels['pick'], tabs)),
        'header': header,
        'footer': footer,
        'panels': '\n\n'.join(panels),
        'scripts': script_tags,
        'enlarge': labels['enlarge'],
        'close': labels['close'],
    }


def main():
    data = json.loads(read(os.path.join(ROOT, 'content', 'tour.json')))
    for lang in LANGS:
        out_dir = os.path.join(ROOT, lang, 'explore')
        if not os.path.isdir(out_dir):
            os.makedirs(out_dir)
        path = os.path.join(out_dir, 'index.html')
        io.open(path, 'w', encoding='utf-8', newline='\n').write(build(lang, data))
        print('wrote', os.path.relpath(path, ROOT))

    shown = visible_tracks(data)
    print('\nPublished: %d track(s), %d step(s) - all with real screenshots.'
          % (len(shown), sum(len(visible_steps(t)) for t in shown)))

    hidden_tracks = [t['id'] for t in data['tracks'] if not visible_steps(t)]
    if hidden_tracks:
        print('Hidden (no approved screenshots yet): %s' % ', '.join(hidden_tracks))
    pending = [(t['id'], s['id']) for t in data['tracks']
               for s in t['steps'] if not s.get('image')]
    if pending:
        print('Planned but not published (%d): %s'
              % (len(pending), ', '.join('%s/%s' % p for p in pending)))
        print('Drop real captures into assets/img/tour/ and set "image" in '
              'content/tour.json, then re-run this script.')


if __name__ == '__main__':
    main()
