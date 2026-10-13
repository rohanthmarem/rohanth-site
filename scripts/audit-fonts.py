"""Audit built HTML against shipped fonts, or subset full source fonts to a separate folder.

Requires fonttools[woff] in a separate Python environment, not a site dependency.
  python scripts/audit-fonts.py
  python scripts/audit-fonts.py --source /path/to/original/fonts --output /tmp/font-subsets
Keep the original font files: an already-subset font cannot restore removed glyphs.
"""
import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont


class PageText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip = 0
        self.text = []

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1
        self.text.extend(v for k, v in attrs if k in ('alt', 'aria-label', 'title') and v)

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, text):
        if not self.skip:
            self.text.append(text)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('public/fonts'))
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    pages = list(Path('dist').rglob('*.html'))
    if not pages:
        parser.error('Build the site first: npx astro build')
    if args.output and args.output.resolve() == args.source.resolve():
        parser.error('Output must differ from the source folder to preserve original fonts')
    text = PageText()
    for page in pages:
        text.feed(page.read_text())
    used = set(map(ord, ''.join(text.text)))
    # Retain ASCII for dates, numbers and scramble effects, plus existing punctuation
    # and arrows for CSS labels and controls that appear only after interaction.
    keep = used | set(range(32, 127)) | {0xa0} | set(range(0x2010, 0x2045)) | set(range(0x2190, 0x219a))
    report = []
    for path in sorted(args.source.glob('*.woff2')):
        font = TTFont(path)
        cmap = set(font.getBestCmap())
        row = dict(font=path.name, bytes=path.stat().st_size, glyphs=len(cmap), retained=len(cmap & keep),
                   unsupported=[f'U+{c:04X}' for c in sorted(used - cmap) if c > 32])
        if args.output:
            options = subset.Options()
            options.flavor = 'woff2'
            sub = subset.Subsetter(options=options)
            sub.populate(unicodes=keep)
            sub.subset(font)
            args.output.mkdir(parents=True, exist_ok=True)
            output = args.output / path.name
            font.save(output)
            row['subsetBytes'] = output.stat().st_size
        report.append(row)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
