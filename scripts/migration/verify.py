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
INLINE_PROSE = {'a', 'span', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'mark', 'code', 'sub', 'sup', 'small', 'abbr', 'cite'}
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
        self.anchor_stack = []
        self.anchor_text = {}
        self.anchor_all = {}  # every text inside the anchored element (figures and bookmarks included)
        self.tags = []

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
                self.tags = [tag]
            return
        if tag not in VOID:
            self.depth += 1
            self.tags.append(tag)
        # Only the first direct paragraph belongs to a list block title.
        for record in self.anchor_stack:
            if tag == 'p' and record['tag'] == 'li' and self.depth == record['depth'] + 1 and not record['paragraph_seen']:
                record['paragraph_seen'] = True
                if not attrs.get('id'):
                    record['prose_depth'] = self.depth
                    record['prose_active'] = True
        if attrs.get('id') and tag not in VOID:
            record = {'id': attrs['id'], 'depth': self.depth, 'tag': tag, 'text': [], 'all': [], 'paragraph_seen': False, 'prose_depth': None, 'prose_active': False}
            self.anchor_stack.append(record)
            self.anchor_text.setdefault(attrs['id'], []).append(record['text'])
            self.anchor_all.setdefault(attrs['id'], []).append(record['all'])
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
        for record in self.anchor_stack:
            if record['prose_depth'] == self.depth:
                record['prose_active'] = False
        self.anchor_stack = [record for record in self.anchor_stack if record["depth"] != self.depth]
        self.tags.pop()
        self.depth -= 1

    def handle_data(self, text):
        if self.depth and not self.ignored:
            self.text.append(text)
            for record in self.anchor_stack:
                record['all'].append(text)
                if record['tag'] == 'p':
                    prose_depth = record['depth']
                elif record['tag'] == 'li' and record['prose_active']:
                    prose_depth = record['prose_depth']
                else:
                    continue
                # Inline code is prose; child code blocks, tables and figures are not.
                if all(tag in INLINE_PROSE for tag in self.tags[prose_depth:]):
                    record['text'].append(text)
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


def correction_text(block, edits):
    text = plain(block.get('properties', {}).get('title'))
    original = text
    for edit in edits:
        old, new = edit.get('oldText', ''), edit.get('newText', '')
        if (block.get('type') not in {'text', 'bulleted_list', 'numbered_list'}
                or block.get('type') != edit.get('sourceType')
                or hashlib.sha256(original.encode()).hexdigest() != edit.get('sourceTextSha256')
                or not old or not new.strip() or old == new or text.count(old) != 1):
            raise ValueError('Correction source mismatch')
        text = text.replace(old, new, 1)
    return text


def redacted_text(block, specs):
    """The title as published after its redactions (replacement is literal text)."""
    text = plain(block.get('properties', {}).get('title'))
    for spec in specs:
        text = re.sub(spec['pattern'], lambda _: spec['replacement'], text, count=1)
    return text


def redaction_issues(report, document, source_blocks, specs):
    """A requested redaction must be applied in its source anchor and traced in the conversion report."""
    issues = []
    for spec in specs:
        if spec['sourceId'] != report.get('sourceId'):
            continue
        trace = next((item for item in report.get('redactions', []) if item.get('id') == spec['id']), {})
        for block_id in spec.get('sourceBlockIds', []):
            def issue(kind): issues.append({'type': kind, 'blockId': block_id, 'redaction': spec['id']})
            block = source_blocks.get(block_id, {})
            hidden = re.findall(spec['pattern'], plain(block.get('properties', {}).get('title')))
            if block.get('type') != spec.get('sourceType') or len(hidden) != 1:
                issue('redaction-source-mismatch'); continue
            if block_id not in trace.get('sourceBlockIds', []): issue('redaction-not-traced')
            scoped = [normalized(''.join(text)) for text in document.anchor_all.get(block_id, [])]
            if not scoped or any(normalized(hidden[0]) in text or normalized(spec['replacement']) not in text for text in scoped):
                issue('redaction-not-applied')
    return issues


def correction_issues(report, document, source_blocks, specs):
    issues = []
    groups = {}
    for edit in specs:
        if edit['sourceId'] == report.get('sourceId'): groups.setdefault(edit['sourceBlockId'], []).append(edit)
    for block_id, edits in groups.items():
        def issue(kind): issues.append({'type': kind, 'blockId': block_id})
        try: expected = normalized(correction_text(source_blocks.get(block_id, {}), edits))
        except ValueError: issue('correction-source-mismatch'); continue
        if any(edit not in report.get('corrections', []) for edit in edits): issue('correction-not-traced')
        scoped = [normalized(''.join(text)) for text in document.anchor_text.get(block_id, [])]
        if not scoped or any(expected not in text for text in scoped): issue('correction-text-missing')
    return issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory', type=Path, default=ROOT / 'docs/migration-inventory.json')
    parser.add_argument('--conversion', type=Path, default=ROOT / 'docs/migration-conversion-report.json')
    parser.add_argument('--dist', type=Path, default=ROOT / 'dist')
    parser.add_argument('--report', type=Path, default=ROOT / 'docs/migration-verification.json')
    parser.add_argument('--only', help='Verify one source UUID while checking all built internal links')
    args = parser.parse_args()
    registry = json.loads((ROOT / 'docs/migration-figures.json').read_text())
    figure_specs = registry['figures']
    correction_specs = registry.get('corrections', [])
    redaction_specs = registry.get('redactions', [])
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
        issues.extend(correction_issues(report, document, source_blocks, correction_specs))
        issues.extend(redaction_issues(report, document, source_blocks, redaction_specs))
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
            hidden_by = [spec for spec in redaction_specs if spec['sourceId'] == entry['sourceId'] and item['sourceBlockId'] in spec.get('sourceBlockIds', [])]
            for field in fields:
                text = plain(props.get(field))
                # A redacted title is compared as published, so a failure can never write the hidden value into the report.
                if hidden_by and field == 'title':
                    text = redacted_text(block, hidden_by)
                edits = [edit for edit in correction_specs if edit['sourceId'] == entry['sourceId'] and edit['sourceBlockId'] == item['sourceBlockId']] if field == 'title' else []
                if edits:
                    try: text = correction_text(block, edits)
                    except ValueError: continue  # Explicit correction-source-mismatch is reported above.
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
