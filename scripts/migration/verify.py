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
from urllib.parse import unquote, urlsplit, urljoin

ROOT = Path(__file__).resolve().parents[2]
INLINE_PROSE = {'a', 'span', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'mark', 'code', 'sub', 'sup', 'small', 'abbr', 'cite', 'label'}
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
        self.evidence_groups = []
        self.evidence_stack = []
        self.anchor_stack = []
        self.anchor_text = {}
        self.anchor_all = {}  # every text inside the anchored element (figures and bookmarks included)
        self.anchor_elements = {}  # shape and all raw contents of an omission anchor
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
        for record in self.anchor_stack:
            record['children'] += 1
            record['elements'].append((tag, attrs))
            for key in ('src', 'href'):
                if attrs.get(key): record['links'].append(attrs[key])
        for record in self.evidence_stack:
            if attrs.get('id'): record['ids'].append(attrs['id'])
            if tag == 'details': record['nestedDetails'] += 1
            if tag == 'summary' and self.depth == record['depth'] + 1: record['summaryDepth'] = self.depth
        # Only the first direct paragraph belongs to a list/callout block title.
        for record in self.anchor_stack:
            prose_container = (record['tag'] == 'li' or record['tag'] == 'blockquote'
                               and 'notion-callout' in record['attrs'].get('class', record['attrs'].get('classname', '')).split())
            if tag == 'p' and prose_container and self.depth == record['depth'] + 1 and not record['paragraph_seen']:
                record['paragraph_seen'] = True
                if not attrs.get('id'):
                    record['prose_depth'] = self.depth
                    record['prose_active'] = True
        if attrs.get('id') and tag not in VOID:
            record = {'id': attrs['id'], 'depth': self.depth, 'tag': tag, 'attrs': attrs,
                      'text': [], 'all': [], 'raw': [], 'links': [], 'elements': [], 'children': 0,
                      'paragraph_seen': False, 'prose_depth': None, 'prose_active': False}
            self.anchor_stack.append(record)
            self.anchor_text.setdefault(attrs['id'], []).append(record['text'])
            self.anchor_all.setdefault(attrs['id'], []).append(record['all'])
            self.anchor_elements.setdefault(attrs['id'], []).append(record)
        if tag in {'script', 'style'}:
            self.ignored += 1
        if attrs.get('data-figure-id'):
            record = {'figureId': attrs['data-figure-id'], 'sourceBlockId': attrs.get('data-source-block-id'), 'text': [], 'depth': self.depth}
            self.figures.append(record)
            self.figure_stack.append(record)
        if attrs.get('data-figure-evidence-for'):
            record = {'figureId': attrs['data-figure-evidence-for'], 'tag': tag, 'attrs': attrs,
                      'depth': self.depth, 'ids': [], 'summary': [], 'summaryDepth': None, 'nestedDetails': 0}
            self.evidence_groups.append(record); self.evidence_stack.append(record)
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
        for record in self.evidence_stack:
            if record['summaryDepth'] == self.depth: record['summaryDepth'] = None
        self.evidence_stack = [record for record in self.evidence_stack if record['depth'] != self.depth]
        for record in self.anchor_stack:
            if record['prose_depth'] == self.depth:
                record['prose_active'] = False
        self.anchor_stack = [record for record in self.anchor_stack if record["depth"] != self.depth]
        self.tags.pop()
        self.depth -= 1

    def handle_data(self, text):
        if self.depth:
            for record in self.anchor_stack: record['raw'].append(text)
            for record in self.evidence_stack:
                if record['summaryDepth'] is not None: record['summary'].append(text)
        if self.depth and not self.ignored:
            self.text.append(text)
            for record in self.anchor_stack:
                record['all'].append(text)
                if record['tag'] == 'p':
                    prose_depth = record['depth']
                elif record['tag'] in {'li', 'blockquote'} and record['prose_active']:
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
        if 'evidenceGroup' in spec:
            group = spec['evidenceGroup']; ids = group.get('blockIds', [])
            source_ids = source_blocks.get(spec['sourceId'], {}).get('content', [])
            if (not ids or len(ids) != len(set(ids)) or not isinstance(group.get('label'), str)
                    or not group['label'].strip()
                    or not set(spec.get('evidenceBlockIds', [])) <= set(ids)
                    or set(ids) & {item['sourceBlockId'] for item in specs if item['sourceId'] == spec['sourceId']}
                    or any(source_blocks.get(value, {}).get('type') not in {'header','sub_header','sub_sub_header','image'}
                           or source_blocks[value].get('content') for value in ids)
                    or any(source_blocks[value]['type'] == 'image' and value not in spec.get('evidenceBlockIds', []) for value in ids)
                    or sum(source_ids[index:index+len(ids)] == ids for index in range(len(source_ids))) != 1):
                issue('figure-evidence-group-source-mismatch')
            if {'figureId': spec['figureId'], **group} not in report.get('evidenceGroups', []):
                issue('figure-evidence-group-not-traced')
            rendered = [item for item in document.evidence_groups if item['figureId'] == spec['figureId']]
            if len(rendered) != 1:
                issue('figure-evidence-group-not-rendered')
            elif (rendered[0]['tag'] != 'details' or 'open' in rendered[0]['attrs']
                  or 'figure-source' not in rendered[0]['attrs'].get('class', rendered[0]['attrs'].get('classname', '')).split()
                  or normalized(''.join(rendered[0]['summary'])) != normalized(group.get('label', ''))
                  or [value for value in rendered[0]['ids'] if value in ids] != ids
                  or rendered[0]['nestedDetails']):
                issue('figure-evidence-group-content-mismatch')
    return issues


def correction_text(block, edits):
    original_runs = json.loads(json.dumps(block.get('properties', {}).get('title', [])))
    runs = json.loads(json.dumps(original_runs))
    original = plain(original_runs)
    for edit in edits:
        old, new = edit.get('oldText', ''), edit.get('newText', '')
        removing = 'removeRun' in edit
        if (not (block.get('type') in {'text', 'bulleted_list', 'numbered_list', 'callout'}
                 or block.get('type') == 'to_do' and edit.get('removeRun') is True)
                or block.get('type') != edit.get('sourceType')
                or hashlib.sha256(original.encode()).hexdigest() != edit.get('sourceTextSha256')
                or not old or old == new or original.count(old) != 1 or plain(runs).count(old) != 1
                or removing and (edit['removeRun'] is not True or new != '')
                or not removing and not new.strip()):
            raise ValueError('Correction source mismatch')
        matches = [run for run in runs if isinstance(run, list) and run and old in run[0]]
        if len(matches) != 1: raise ValueError('Correction crosses source annotations')
        if removing:
            original_matches = [run for run in original_runs if isinstance(run, list) and run and run[0] == old]
            if matches[0][0] != old or len(original_matches) != 1:
                raise ValueError('Run removal must match the complete source run')
            runs = [run for run in runs if run is not matches[0]]
            if not plain(runs).strip(): raise ValueError('Run removal cannot empty the block text')
        else:
            matches[0][0] = matches[0][0].replace(old, new, 1)
    return plain(runs)


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
        for edit in edits:
            removed = normalized(edit['oldText']) if edit.get('removeRun') is True else ''
            if removed and any(text.count(removed) > expected.count(removed) for text in scoped):
                issue('correction-run-not-removed')
    return issues


def source_target(url, report, pages):
    """Resolve the existing source link rules independently of rendered HTML."""
    def canonical(value):
        compact = value.replace('-', '').lower()
        return '-'.join((compact[:8],compact[8:12],compact[12:16],compact[16:20],compact[20:]))
    if url.startswith('#'):
        fragment = url[1:]
        return '#' + (canonical(fragment) if re.fullmatch('[0-9a-f-]{32,36}',fragment,re.I) else fragment)
    parsed = urlsplit(url)
    if parsed.scheme and parsed.scheme not in {'https','http','mailto','tel'}: return ''
    owned = (not parsed.netloc or parsed.netloc.lower() in
             {'www.brainbackdoor.com','brainbackdoor.com','www.notion.so','notion.so'} or parsed.netloc.endswith('.notion.site'))
    if owned:
        match = re.search(r'(?<![0-9a-f])([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})(?![0-9a-f])',parsed.path,re.I)
        if match:
            page = next((page for page in pages if page['sourceId'] == canonical(match[1])), {})
            if page.get('targetPath'):
                fragment = canonical(parsed.fragment) if re.fullmatch('[0-9a-f-]{32,36}',parsed.fragment,re.I) else parsed.fragment
                return page['targetPath'].split('#',1)[0] + '#' + fragment if fragment else page['targetPath']
            if page.get('contentRole') == 'project-reference':
                return (page.get('referenceUrl') or page['sourceUrl']) + ('#'+parsed.fragment if parsed.fragment else '')
        else:
            for page in pages:
                if page.get('targetPath') and any(urlsplit(alias).path.rstrip('/') == parsed.path.rstrip('/')
                    for alias in [page.get('sourceUrl',''), *page.get('aliases',[])] if alias):
                    return page['targetPath'] + ('#'+parsed.fragment if parsed.fragment else '')
    return urljoin(report.get('sourceUrl') or 'https://www.brainbackdoor.com/',url)


def omission_issues(report, document, source_blocks, specs, figures=(), corrections=(), redactions=(), pages=()):
    """Omissions need exact source approval, full trace and an empty hidden anchor."""
    issues = []; source_id = report.get('sourceId')
    approved = [spec for spec in specs if spec.get('sourceId') == source_id]
    protected = {block_id for spec in figures if spec.get('sourceId') == source_id
                 for block_id in [spec['sourceBlockId'], *spec.get('evidenceBlockIds', []),
                                  *(spec.get('evidenceGroup') or {}).get('blockIds', [])]}
    protected.update(spec['sourceBlockId'] for spec in corrections if spec.get('sourceId') == source_id)
    protected.update(block_id for spec in redactions if spec.get('sourceId') == source_id
                     for block_id in spec.get('sourceBlockIds', []))
    allowed = {'text', 'bulleted_list', 'numbered_list', 'to_do', 'image', 'callout', 'quote', 'divider',
               'header', 'sub_header', 'sub_sub_header', 'table'}
    names = set(); blocks = set(); alias_ids = set()
    for spec in approved:
        block_id = spec.get('sourceBlockId'); block = source_blocks.get(block_id, {})
        def issue(kind): issues.append({'type': kind, 'blockId': block_id, 'omission': spec.get('id')})
        fingerprint = hashlib.sha256(json.dumps(block, ensure_ascii=False, sort_keys=True,
                                               separators=(',', ':')).encode('utf-8')).hexdigest()
        if (not isinstance(spec.get('id'), str) or not spec['id'].strip()
                or not isinstance(spec.get('reason'), str) or not spec['reason'].strip()
                or spec['id'] in names or block_id in blocks):
            issue('omission-invalid-spec')
        names.add(spec.get('id')); blocks.add(block_id)
        field = spec.get('field')
        supported = (block.get('type') in allowed if field is None else
                     field == 'description' and block.get('type') in {'bookmark', 'video', 'embed'}
                     and bool(plain(block.get('properties', {}).get('description')).strip()))
        if (not supported or block.get('type') != spec.get('sourceType')
                or fingerprint != spec.get('sourceBlockSha256') or field is None and block.get('content')):
            issue('omission-source-mismatch')
        if block_id in protected: issue('omission-overlaps-preserved-source')
        if 'keepAsDescription' in spec and (spec['keepAsDescription'] is not True
                or field is not None or block.get('type') != 'callout'):
            issue('omission-invalid-description-flag')
        aliases = spec.get('anchorAliases', [])
        if 'anchorAliases' in spec:
            if (field is not None or block.get('type') not in {'header','sub_header','sub_sub_header'}
                    or not isinstance(aliases, list)
                    or any(not isinstance(alias, str) or not alias or re.search(r'\s', alias) for alias in aliases)
                    or len(aliases) != len(set(aliases)) or set(aliases) & (set(source_blocks) | alias_ids)):
                issue('omission-invalid-anchor-aliases'); aliases = []
            alias_ids.update(aliases)
        records = [item for item in report.get('blocks', []) if item.get('sourceBlockId') == block_id]
        exclusions = [item for item in report.get('excluded', []) if item.get('sourceBlockId') == block_id]
        def traced(item, status):
            return (item.get('status') == status
                    and item.get('type') == spec.get('sourceType')
                    and item.get('omissionId') == spec.get('id')
                    and item.get('sourceBlockSha256') == spec.get('sourceBlockSha256')
                    and item.get('reason') == spec.get('reason')
                    and ('anchorAliases' not in spec or item.get('anchorAliases') == spec['anchorAliases']))
        if (spec not in report.get('omissions', []) or not records or not exclusions
                or not all(traced(item, 'converted-with-editorial-omission' if field else 'excluded-editorial-duplicate')
                           and (not field or field in item.get('omittedFields', [])) for item in records)
                or not all(traced(item, 'excluded-editorial-duplicate') and (not field or item.get('field') == field) for item in exclusions)):
            issue('omission-not-traced')
        anchors = [record for anchor, records in document.anchor_elements.items()
                   if re.fullmatch(re.escape(str(block_id)) + r'(?:-copy-\d+)?', anchor)
                   for record in records]
        if not anchors: issue('omission-anchor-missing')
        if field:
            description = normalized(plain(block.get('properties', {}).get(field)))
            title = normalized(plain(block.get('properties', {}).get('title')))
            source = plain(block.get('properties', {}).get('source')) or plain(block.get('properties', {}).get('link')) or block.get('format', {}).get('display_source', '')
            if any(description and description in normalized(''.join(record['raw'])) for record in anchors):
                issue('omission-field-still-rendered')
            assets = [item for item in report.get('assets', []) if item.get('blockId') == block_id]
            downloadable = block.get('type') == 'video' and re.search(r'\.(mp4|webm|mov)(\?|$)',source,re.I)
            asset = next((item for item in assets if item.get('sourceUrl') == source), {})
            href = asset.get('localPath', '') if downloadable else source_target(source, report, pages)
            fmt = block.get('format', {})
            video = block.get('type') == 'video' and href.startswith('/content/')
            embed = fmt.get('display_source') or ''
            match = re.search(r'(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/))([\w-]{11})',source)
            if match: embed = 'https://www.youtube-nocookie.com/embed/' + match[1]
            if not embed and block.get('type') in {'embed','video'} and source.startswith('https://') and not video: embed = source
            iframe = embed if embed and urlsplit(embed).scheme == 'https' else ''
            cover = fmt.get('bookmark_cover')
            cover_asset = next((item for item in assets if item.get('sourceUrl') == cover), {}) if cover else {}
            expected_cover = (cover_asset.get('localPath') if cover and not
                              (block.get('type') == 'bookmark' and cover_asset.get('status') in {'failed','not-downloaded'}) else None)
            def has_element(record, tag, key, value):
                return any(found_tag == tag and attrs.get(key) == value for found_tag, attrs in record['elements'])
            if any(title and title not in normalized(''.join(record['raw']))
                   or source and (not href or not has_element(record,'a','href',href))
                   or iframe and not has_element(record,'iframe','src',iframe)
                   or video and not has_element(record,'video','src',href)
                   or cover and (not cover_asset or expected_cover and not has_element(record,'img','src',expected_cover))
                   for record in anchors):
                issue('omission-preserved-content-missing')
        elif any(record['tag'] != 'span' or 'hidden' not in record['attrs']
                 or record['attrs'].get('data-editorial-omission') != spec.get('id')
                 or record['children'] or ''.join(record['raw']).strip() for record in anchors):
            issue('omission-anchor-not-empty')
        for alias in aliases:
            records = document.anchor_elements.get(alias, [])
            if document.ids.count(alias) != 1 or len(records) != 1:
                issue('omission-alias-missing-or-duplicate')
            elif (records[0]['tag'] != 'div' or records[0]['attrs'].get('aria-hidden') != 'true'
                  or 'hidden' in records[0]['attrs'] or records[0]['children'] or ''.join(records[0]['raw']).strip()):
                issue('omission-alias-not-empty')
    for item in [*report.get('blocks', []), *report.get('excluded', []), *report.get('omissions', [])]:
        if (item.get('status') in {'excluded-editorial-duplicate', 'converted-with-editorial-omission'} or item in report.get('omissions', [])):
            if not any(spec.get('sourceBlockId') == item.get('sourceBlockId')
                       and spec.get('id') == (item.get('omissionId') or item.get('id')) for spec in approved):
                issues.append({'type': 'omission-not-approved', 'blockId': item.get('sourceBlockId')})
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
    omission_specs = registry.get('omissions', [])
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
        issues.extend(omission_issues(report, document, source_blocks, omission_specs,
                                     figure_specs, correction_specs, redaction_specs, inventory))
        omitted_blocks = {spec['sourceBlockId'] for spec in omission_specs if spec['sourceId'] == entry['sourceId'] and not spec.get('field')}
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
                if any(spec['sourceId'] == entry['sourceId'] and spec['sourceBlockId'] == item['sourceBlockId']
                       and spec.get('field') == field for spec in omission_specs):
                    continue
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
            if (asset['blockId'] not in omitted_blocks
                    and source_blocks.get(asset['blockId'], {}).get('type') in {'image', 'file', 'pdf'}
                    and asset['localPath'] not in document.links):
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
