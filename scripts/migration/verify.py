#!/usr/bin/env python3
"""Compare cached public source blocks with the built reading surface."""
import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


class ReadingPage(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.ignored = 0
        self.text = []
        self.ids = []
        self.links = []
        self.images = []
        self.unreserved_images = []
        self.pre = []
        self.current_pre = None
        self.figures = []
        self.figure_stack = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.append(attrs['id'])
        for key in ('src', 'href'):
            if attrs.get(key):
                self.links.append(attrs[key])
        if not self.depth:
            if 'post-content' in attrs.get('class', '').split():
                self.depth = 1
            return
        if tag not in VOID:
            self.depth += 1
        if tag in {'script', 'style'}:
            self.ignored += 1
        if attrs.get('data-figure-id'):
            record = {'figureId': attrs['data-figure-id'], 'sourceBlockId': attrs.get('data-source-block-id'), 'text': [], 'depth': self.depth}
            self.figures.append(record)
            self.figure_stack.append(record)
        if tag == 'pre':
            self.current_pre = []
        if tag == 'img':
            self.images.append(attrs.get('src', ''))
            if attrs.get('src', '').startswith('/content/') and not (str(attrs.get('width', '')).isdigit() and str(attrs.get('height', '')).isdigit() and int(attrs['width']) > 0 and int(attrs['height']) > 0):
                self.unreserved_images.append(attrs.get('src', ''))

    def handle_endtag(self, tag):
        if not self.depth or tag in VOID:
            return
        if tag == 'pre' and self.current_pre is not None:
            self.pre.append(''.join(self.current_pre).strip('\n'))
            self.current_pre = None
        if tag in {'script', 'style'}:
            self.ignored = max(0, self.ignored - 1)
        self.figure_stack = [record for record in self.figure_stack if record["depth"] != self.depth]
        self.depth -= 1

    def handle_data(self, text):
        if self.depth and not self.ignored:
            self.text.append(text)
            for record in self.figure_stack:
                record["text"].append(text)
            if self.current_pre is not None:
                self.current_pre.append(text)


def plain(runs):
    return ''.join(run[0] for run in (runs or []) if isinstance(run, list) and run and isinstance(run[0], str))


def normalized(text):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', text)).replace('‣', '').replace('\u200b', '')


def figure_issues(report, document, source_blocks, specs):
    issues = []
    for spec in specs:
        if spec['sourceId'] != report.get('sourceId'):
            continue
        def issue(kind, **extra):
            issues.append({'type': kind, 'figureId': spec['figureId'], 'blockId': spec['sourceBlockId'], **extra})
        block = source_blocks.get(spec['sourceBlockId'], {})
        if block.get('type') != spec['sourceType'] or (spec['mode'] == 'replace' and block.get('type') != 'image'):
            issue('figure-source-type-mismatch')
        if not any(all(item.get(key) == spec[key] for key in ['figureId', 'sourceBlockId', 'sourceType', 'mode']) for item in report.get('figures', [])):
            issue('figure-not-traced')
        if spec['sourceBlockId'] not in document.ids:
            issue('figure-anchor-missing')
        figures = [item for item in document.figures if item['figureId'] == spec['figureId'] and item['sourceBlockId'] == spec['sourceBlockId']]
        if not figures:
            issue('figure-not-rendered')
        for figure in figures:
            text = normalized(''.join(figure['text']))
            for expected in spec['requiredText']:
                if normalized(expected) not in text:
                    issue('figure-information-missing', missingText=expected)
    return issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory', type=Path, default=ROOT / 'docs/migration-inventory.json')
    parser.add_argument('--conversion', type=Path, default=ROOT / 'docs/migration-conversion-report.json')
    parser.add_argument('--dist', type=Path, default=ROOT / 'dist')
    parser.add_argument('--report', type=Path, default=ROOT / 'docs/migration-verification.json')
    parser.add_argument('--only', help='Verify one source UUID while checking all built internal links')
    args = parser.parse_args()
    figure_specs = json.loads((ROOT / 'docs/migration-figures.json').read_text())['figures']
    inventory_data = json.loads(args.inventory.read_text())
    inventory = inventory_data['pages']
    source_blocks = {}
    for entry in inventory:
        source = Path(entry.get('sourcePath', ''))
        if source.is_file():
            snapshot = json.loads(source.read_text())
            source_blocks.update({key: record.get('value', record) for key, record in snapshot['recordMap']['block'].items()})
    converted = {p['sourceId']: p for p in json.loads(args.conversion.read_text())['pages']}
    results = []
    broken_links = []
    built = {}
    for file in args.dist.rglob('*.html'):
        document = ReadingPage()
        document.feed(file.read_text())
        built[file] = document
    for entry in inventory:
        if entry.get('kind') != 'post':
            continue
        if args.only and entry['sourceId'] != args.only:
            continue
        issues = []
        output = args.dist / entry['targetPath'].strip('/') / 'index.html'
        report = converted.get(entry['sourceId'], {})
        if not output.exists() or report.get('status') != 'converted':
            results.append({'sourceId': entry['sourceId'], 'title': entry['title'], 'issues': ['not-built-or-converted']})
            continue
        document = built[output]
        issues.extend(figure_issues(report, document, source_blocks, figure_specs))
        body = normalized(''.join(document.text))
        checked = 0
        excluded = []
        traced = {item['sourceBlockId'] for item in report.get('blocks', [])}
        expected_blocks = set()

        def walk(block_id):
            if block_id in expected_blocks:
                return
            expected_blocks.add(block_id)
            block = source_blocks.get(block_id, {})
            if block.get('type') in {'page', 'link_to_page'}:
                return
            for child in block.get('content', []):
                walk(child)

        for child in source_blocks[entry['sourceId']].get('content', []):
            walk(child)
        for missing in sorted(expected_blocks - traced):
            issues.append({'blockId': missing, 'type': 'untraced-source-block'})
        for item in report.get('blocks', []):
            if item.get('status', '').startswith('excluded'):
                excluded.append(item['sourceBlockId'])
                continue
            if item.get('status') == 'rendered-source-html-links':
                for link in item.get('preservedLinks', []):
                    checked += 1
                    if normalized(link['label']) not in body or link['sourceUrl'] not in document.links:
                        issues.append({'blockId': item['sourceBlockId'], 'type': 'missing-rendered-source-link'})
                continue
            block = source_blocks.get(item['sourceBlockId'], {})
            if not block:
                issues.append({'blockId': item['sourceBlockId'], 'type': 'source-block-not-found'})
                continue
            props = block.get('properties', {})
            fields = list(props) if item['type'] == 'table_row' else item.get('visibleProperties', ['title', 'caption', 'description'])
            # Image/file titles can be alt text or filenames; caption is the reading content.
            if item['type'] in {'image', 'file', 'audio', 'video', 'embed', 'bookmark'}:
                fields = ['caption', 'description']
            for field in fields:
                text = plain(props.get(field))
                expected = normalized(text)
                if not expected:
                    continue
                checked += 1
                # Notion page mentions insert their resolved title between text runs.
                # Check each original run when a mention placeholder is present.
                expected_parts = [normalized(part) for part in text.split('‣') if normalized(part)]
                if not all(part in body for part in expected_parts):
                    issues.append({'blockId': item['sourceBlockId'], 'type': item['type'], 'field': field, 'missingText': text[:160]})
                if item['type'] == 'code' and field == 'title' and text.strip('\n') not in document.pre:
                    issues.append({'blockId': item['sourceBlockId'], 'type': 'code-whitespace-mismatch'})
        for asset in report.get('assets', []):
            if asset.get('status') != 'downloaded':
                continue
            path = ROOT / 'public' / asset['localPath'].lstrip('/')
            if not path.is_file():
                issues.append({'asset': asset['localPath'], 'type': 'missing-local-asset'})
            elif hashlib.sha256(path.read_bytes()).hexdigest() != asset['sha256']:
                issues.append({'asset': asset['localPath'], 'type': 'asset-hash-mismatch'})
            if source_blocks.get(asset['blockId'], {}).get('type') in {'image', 'file', 'pdf'} and asset['localPath'] not in document.links:
                issues.append({'asset': asset['localPath'], 'type': 'asset-not-rendered'})
        duplicates = [key for key, count in Counter(document.ids).items() if count > 1]
        if duplicates:
            issues.append({'type': 'duplicate-id', 'ids': duplicates})
        for source in document.unreserved_images:
            issues.append({'type': 'image-dimensions-missing', 'src': source})
        results.append({'sourceId': entry['sourceId'], 'title': entry['title'], 'targetPath': entry['targetPath'], 'checkedTextFields': checked, 'renderedImages': len(document.images), 'renderedFigures': len(document.figures), 'excludedBlocks': excluded, 'issues': issues})
    for file, document in built.items():
        for ref in document.links:
            url = urlsplit(ref)
            if url.scheme or url.netloc:
                continue
            path = unquote(url.path)
            target = args.dist / path.lstrip('/') if path.startswith('/') else file.parent / path
            if not path:
                target = file
            elif target.is_dir() or not target.suffix:
                target = target / 'index.html'
            if not target.exists():
                broken_links.append({'page': str(file.relative_to(args.dist)), 'href': ref, 'reason': 'missing-path'})
            elif url.fragment and target in built and unquote(url.fragment) not in built[target].ids:
                broken_links.append({'page': str(file.relative_to(args.dist)), 'href': ref, 'reason': 'missing-anchor'})
    unavailable_previews = [{'sourceId': page['sourceId'], 'blockId': asset['blockId'], 'sourceUrl': asset['sourceUrl']} for page in converted.values() for asset in page.get('assets', []) if asset.get('status') == 'failed']
    result = {'pages': results, 'brokenInternalLinks': broken_links, 'knownSourceLimitations': {'unavailablePages': inventory_data.get('failures', []), 'unavailableAssets': unavailable_previews}, 'summary': {'pages': len(results), 'textFields': sum(p.get('checkedTextFields', 0) for p in results), 'figures': sum(p.get('renderedFigures', 0) for p in results), 'pagesWithIssues': sum(bool(p['issues']) for p in results), 'brokenInternalLinks': len(broken_links), 'unavailableSourcePages': len(inventory_data.get('failures', [])), 'unavailableAssets': len(unavailable_previews)}}
    args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result['summary'], ensure_ascii=False))
    return int(bool(result['summary']['pagesWithIssues'] or broken_links))


if __name__ == '__main__':
    raise SystemExit(main())
