#!/usr/bin/env python3
"""Convert cached public Notion pageProps to local MDX without summarizing content.

Network requests are only for original public media. Source snapshots stay outside
this repository; the report records hashes, block coverage and asset status.
"""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import html
import json
import mimetypes
from pathlib import Path
import re
import sys
import struct
from functools import lru_cache
from urllib.parse import quote, unquote, urlsplit, urljoin, parse_qs
from html.parser import HTMLParser
from urllib.request import Request, urlopen

REPO = Path(__file__).resolve().parents[2]
UUID_RE = re.compile(r"(?<![0-9a-f])([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})(?![0-9a-f])", re.I)
LANGUAGES = {'plain text': 'text', 'plaintext': 'text', 'shell': 'bash', 'shell script': 'bash', 'bash': 'bash', 'java': 'java', 'javascript': 'javascript', 'typescript': 'typescript', 'json': 'json', 'yaml': 'yaml', 'yml': 'yaml', 'sql': 'sql', 'python': 'python', 'ruby': 'ruby', 'go': 'go', 'c++': 'cpp', 'c#': 'csharp', 'c': 'c', 'docker': 'dockerfile', 'dockerfile': 'dockerfile', 'html': 'html', 'css': 'css', 'markdown': 'markdown', 'kotlin': 'kotlin', 'xml': 'xml', 'http': 'http', 'powershell': 'powershell', 'toml': 'toml', 'properties': 'properties', 'ini': 'ini', 'diff': 'diff', 'scss': 'scss', 'r': 'r', 'rust': 'rust', 'swift': 'swift', 'objective-c': 'objective-c', 'makefile': 'makefile', 'elixir': 'elixir', 'haskell': 'haskell', 'clojure': 'clojure', 'latex': 'latex', 'graphql': 'graphql', 'groovy': 'groovy', 'text': 'text'}


def canonical_id(value):
    compact = str(value).replace('-', '').lower()
    return '-'.join((compact[:8], compact[8:12], compact[12:16], compact[16:20], compact[20:])) if re.fullmatch('[0-9a-f]{32}', compact) else str(value)


def plain(runs):
    return ''.join(str(run[0]) for run in (runs or []) if isinstance(run, list) and run)


def text_escape(value):
    value = html.escape(str(value), quote=False)
    # Entities survive MDX without turning source punctuation into syntax.
    # Encode literal URL/email triggers too: GFM autolinks otherwise re-escape
    # entities inside a source URL, visibly changing underscores and fragments.
    value = re.sub(r'[{}*_`\[\]#\\~:.@]', lambda match: f'&#{ord(match.group())};', value)
    return value.replace('\n', '<br />')


def attr(value):
    return html.escape(str(value), quote=True).replace('{', '&#123;').replace('}', '&#125;')


@lru_cache(maxsize=None)
def image_dimensions(filename):
    """Read intrinsic image size without decoding or modifying the image."""
    path=Path(filename)
    if not path.is_file(): return None
    data=path.read_bytes()
    if data.startswith(b'\x89PNG\r\n\x1a\n') and len(data)>=24:
        return struct.unpack('>II',data[16:24])
    if data[:6] in [b'GIF87a',b'GIF89a'] and len(data)>=10:
        return struct.unpack('<HH',data[6:10])
    if data[:4]==b'RIFF' and data[8:12]==b'WEBP':
        offset=12
        while offset+8<=len(data):
            kind=data[offset:offset+4]; length=int.from_bytes(data[offset+4:offset+8],'little')
            chunk=data[offset+8:offset+8+length]
            if kind==b'VP8X' and len(chunk)>=10:
                return (int.from_bytes(chunk[4:7],'little')+1,int.from_bytes(chunk[7:10],'little')+1)
            if kind==b'VP8 ' and len(chunk)>=10 and chunk[3:6]==b'\x9d\x01\x2a':
                return (int.from_bytes(chunk[6:8],'little')&0x3fff,int.from_bytes(chunk[8:10],'little')&0x3fff)
            if kind==b'VP8L' and len(chunk)>=5 and chunk[0]==0x2f:
                bits=int.from_bytes(chunk[1:5],'little')
                return ((bits&0x3fff)+1,((bits>>14)&0x3fff)+1)
            offset+=8+length+(length&1)
    if data.startswith(b'\xff\xd8'):
        offset=2; dimensions=None; orientation=1
        while offset+4<=len(data):
            if data[offset]!=0xff: break
            while offset<len(data) and data[offset]==0xff: offset+=1
            if offset>=len(data): break
            marker=data[offset]; offset+=1
            if marker in [0xd9,0xda]: break
            if marker in [0xd8,0x01] or 0xd0<=marker<=0xd7: continue
            size=int.from_bytes(data[offset:offset+2],'big')
            if size<2: break
            segment=data[offset+2:offset+size]; offset+=size
            if marker in [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf] and len(segment)>=5:
                dimensions=(int.from_bytes(segment[3:5],'big'),int.from_bytes(segment[1:3],'big'))
            if marker==0xe1 and segment.startswith(b'Exif\x00\x00'):
                tiff=segment[6:]; endian='little' if tiff[:2]==b'II' else 'big'
                if len(tiff)<8: continue
                start=int.from_bytes(tiff[4:8],endian)
                count=int.from_bytes(tiff[start:start+2],endian)
                for index in range(count):
                    field=tiff[start+2+index*12:start+14+index*12]
                    if len(field)==12 and int.from_bytes(field[:2],endian)==0x112:
                        orientation=int.from_bytes(field[8:10],endian)
        if dimensions:
            return dimensions[::-1] if orientation in [5,6,7,8] else dimensions
    return None


def local_image_attributes(url, output_root=REPO):
    if not url.startswith('/content/'): return ''
    dimensions=image_dimensions(str(Path(output_root)/'public'/url.lstrip('/')))
    return f' width="{dimensions[0]}" height="{dimensions[1]}"' if dimensions else ''


def source_date(root):
    for key, runs in root.get('properties', {}).items():
        for run in runs:
            for deco in (run[1] if len(run) > 1 else []):
                if deco[0] == 'd' and isinstance(deco[1], dict) and deco[1].get('start_date'):
                    return deco[1]['start_date'], f'page.properties.{key}.date.start_date'
    return None, None


class Converter:
    def __init__(self, page_props, entry, inventory, download=True, output_root=REPO):
        self.props = page_props
        self.entry = entry
        self.page_id = canonical_id(entry['sourceId'])
        self.blocks = {canonical_id(k): v.get('value', v) for k, v in page_props['recordMap']['block'].items()}
        self.collections = {canonical_id(k): v.get('value', v) for k, v in page_props['recordMap'].get('collection', {}).items()}
        self.views = {canonical_id(k): v.get('value', v) for k, v in page_props['recordMap'].get('collection_view', {}).items()}
        def merge_queries(value):
            if not isinstance(value, dict): return
            if isinstance(value.get('recordMap'), dict):
                for key, block in value['recordMap'].get('block', {}).items():
                    self.blocks.setdefault(canonical_id(key), block.get('value', block))
                for key, collection in value['recordMap'].get('collection', {}).items():
                    self.collections.setdefault(canonical_id(key), collection.get('value', collection))
            for child in value.values():
                if isinstance(child, dict): merge_queries(child)
        merge_queries(page_props.get('queryCollectionResult'))
        # Collection query snapshots contain row metadata; each public row page
        # supplies its nested body blocks separately.
        for item in inventory:
            if canonical_id((item.get('embedding') or {}).get('parentId','')) == self.page_id and item.get('sourcePath'):
                cached = Path(item['sourcePath'])
                if cached.exists():
                    nested = json.loads(cached.read_text())
                    for key, block in nested.get('recordMap',{}).get('block',{}).items():
                        if block.get('value',{}).get('type'): self.blocks[canonical_id(key)] = block.get('value',block)
                    merge_queries(nested.get('queryCollectionResult'))
        self.public_media = {}
        owner = self
        class MediaParser(HTMLParser):
            def handle_starttag(self, tag, attrs):
                data = dict(attrs)
                if tag not in ['img','video','source','a','audio']: return
                url = data.get('src') or data.get('href') or ''
                parsed = urlsplit(url)
                if parsed.netloc == 'oopy.lazyrockets.com' and '/notion/' in parsed.path:
                    query = parse_qs(parsed.query)
                    if query.get('blockId') and query.get('src'):
                        owner.public_media[(canonical_id(query['blockId'][0]), query['src'][0])] = url.split('#')[0]
        if entry.get('sourcePath'):
            source_html = Path(entry['sourcePath']).with_suffix('.html')
            if source_html.exists(): MediaParser().feed(source_html.read_text())
        self.root = self.blocks[canonical_id(page_props.get('pageID', self.page_id))]
        self.pages = {canonical_id(p['sourceId']): p for p in inventory}
        self.download = download
        self.output_root = Path(output_root)
        self.report = {'sourceId': self.page_id, 'sourceUrl': entry.get('sourceUrl'), 'targetPath': entry.get('targetPath'), 'blocks': [], 'assets': [], 'unresolvedLinks': [], 'warnings': [], 'excluded': []}
        self.assets = {}
        self.used_ids = Counter()
        self.block_records = {}
        self.heading_min = 3
        self.collect(self.root.get('content', []), set())

    def collect(self, ids, seen):
        for block_id in ids:
            block_id = canonical_id(block_id)
            if block_id in seen: continue
            seen.add(block_id)
            block = self.blocks.get(block_id)
            if not block: continue
            typ = block.get('type')
            if typ in ['header', 'sub_header', 'sub_sub_header']:
                self.heading_min = min(self.heading_min, ['header', 'sub_header', 'sub_sub_header'].index(typ) + 1)
            self.collect(block.get('content', []), seen)

    def issue(self, kind, block_id, **extra):
        self.report['warnings'].append({'kind': kind, 'blockId': block_id, **extra})

    def legacy_navigation(self, block):
        """Recognize the original three-column previous/source/next toolbar."""
        if block.get('type') != 'column_list' or len(block.get('content', [])) != 3:
            return False
        labels = []
        for column_id in block['content']:
            column = self.blocks.get(canonical_id(column_id), {})
            if column.get('type') != 'column': return False
            leaves = [self.blocks.get(canonical_id(child), {}) for child in column.get('content', [])]
            if not leaves or any(leaf.get('content') for leaf in leaves): return False
            nonempty = [leaf for leaf in leaves if plain(leaf.get('properties', {}).get('title')).strip() or leaf.get('type') != 'text']
            if len(nonempty) != 1: return False
            labels.append(nonempty[0])
        previous, source, following = labels
        if previous.get('type') != 'text' or following.get('type') != 'text': return False
        if not re.fullmatch(r'[⬅←]\ufe0f?\s*이전\s*글\s*:.*', plain(previous.get('properties', {}).get('title')).strip()): return False
        if not re.fullmatch(r'[➡→]\ufe0f?\s*다음\s*글\s*:.*', plain(following.get('properties', {}).get('title')).strip()): return False
        if source.get('type') == 'text':
            runs = source.get('properties', {}).get('title', [])
            return plain(runs).strip() == '‣' and any(
                decoration[0] == 'p' for run in runs for decoration in (run[1] if len(run) > 1 else []))
        if source.get('type') == 'alias':
            pointer = source.get('format', {}).get('alias_pointer', {})
            target = self.blocks.get(canonical_id(pointer.get('id', '')), {})
            return bool(pointer.get('id')) and target.get('type') in [None, 'page']
        return False

    def exclude_navigation(self, block_id, group_id, seen=None):
        """Keep source coverage and hashes for every removed toolbar block."""
        if seen is None: seen = set()
        block_id = canonical_id(block_id)
        if block_id in seen: return
        seen.add(block_id)
        block = self.blocks[block_id]
        raw = plain(block.get('properties', {}).get('title'))
        self.report['blocks'].append({'sourceBlockId': block_id, 'type': block.get('type'),
            'sourceTextChars': len(raw), 'sourceTextSha256': hashlib.sha256(raw.encode()).hexdigest(),
            'status': 'excluded-legacy-navigation', 'navigationGroupId': group_id})
        self.report['excluded'].append({'sourceBlockId': block_id, 'type': block.get('type'),
            'reason': 'Original previous/source/next toolbar removed from the article at the owner\'s request.',
            'navigationGroupId': group_id})
        for child in block.get('content', []): self.exclude_navigation(child, group_id, seen)

    def hidden_configuration(self, block_id, block):
        raw = plain(block.get('properties', {}).get('title')).strip()
        oopy_controls = {'disqus', 'kakaoChannel', 'floatFirstTOC', 'ignoreMainOgImage'}
        oopy_keys = oopy_controls | {'title', 'description', 'ogImage'}
        lines = [line for line in raw.splitlines() if line.strip() and not line.lstrip().startswith('#')]
        fields = [re.fullmatch(r'([A-Za-z][A-Za-z0-9]*):[ \t]*(.*)', line) for line in lines]
        keys = {field[1] for field in fields if field}
        if (block.get('type') == 'code' and fields and all(fields)
                and keys <= oopy_keys and keys & oopy_controls
                and block_id == self.root.get('content', [''])[0]
                and plain(block.get('properties', {}).get('language')).lower() in ['yaml', 'yml']):
            return 'Initial Oopy presentation and SEO configuration is excluded from the article body.'
        if (block.get('type')=='code' and plain(block.get('properties',{}).get('language')).lower()=='html'
                and hashlib.sha256(raw.encode()).hexdigest() in {
                    '825bb098dfeee4add4f0210bb6c9f484e12fd86db526ab3baff2f235b1caafca',
                    '6493c2b801ea95121b12ec00711bc3e4d6499d80cc2dd2dca15abf1050244c5d',
                }):
            return 'Public source UI hides this exact Darass comment-widget HTML configuration (matched by source hash).'
        if self.page_id == '456db3cc-c4e1-4028-a820-45eca7a00002':
            reasons = {
                '61b04c87-34dd-4dba-8aa9-b97ad05c69cc': 'Public birthday invitation hides this page-specific Oopy HTML/CSS configuration.',
                '2694eaa6-88d5-4cce-83d1-b5354d8928f5': 'Public birthday invitation hides the oopy:slide control label; every child image is retained.',
                '91d539b6-150f-4353-8089-814bb5d18071': 'Public birthday invitation hides this Oopy slide configuration YAML.',
                'a1380db4-7fef-4cd0-abc2-36c0a7d28322': 'Public birthday invitation renders this Oopy HTML as a link; its original link label and destination are preserved without presentation CSS.',
            }
            return reasons.get(block_id)
        return None

    def target(self, url, block_id=''):
        if not url: return ''
        url = str(url)
        if url.startswith('#'):
            fragment = url[1:]
            return '#' + (canonical_id(fragment) if re.fullmatch('[0-9a-f-]{32,36}', fragment, re.I) else fragment)
        parsed = urlsplit(url)
        if parsed.scheme and parsed.scheme not in ['https', 'http', 'mailto', 'tel']:
            self.issue('unsupported-url-scheme', block_id, scheme=parsed.scheme)
            return ''
        owned = not parsed.netloc or parsed.netloc.lower() in ['www.brainbackdoor.com', 'brainbackdoor.com', 'www.notion.so', 'notion.so'] or parsed.netloc.endswith('.notion.site')
        if owned:
            match = UUID_RE.search(parsed.path)
            if match:
                page_id = canonical_id(match.group(1))
                page = self.pages.get(page_id)
                if page and page.get('targetPath'):
                    fragment = parsed.fragment
                    if re.fullmatch('[0-9a-f-]{32,36}', fragment, re.I): fragment = canonical_id(fragment)
                    return page['targetPath'].split('#', 1)[0] + f'#{fragment}' if fragment else page['targetPath']
                if page and page.get('contentRole') == 'project-reference':
                    # This is a separately linked project, not an uncollected post.
                    # Use its verified public URL; compact Notion variants may fall back home.
                    reference_url = page.get('referenceUrl') or page['sourceUrl']
                    return reference_url + (f'#{parsed.fragment}' if parsed.fragment else '')
                if parsed.netloc.lower() in ['www.brainbackdoor.com','brainbackdoor.com','www.notion.so','notion.so'] or not parsed.netloc:
                    self.report['unresolvedLinks'].append({'blockId': block_id, 'sourceId': page_id, 'sourceUrl': url})
                return urljoin(self.entry.get('sourceUrl') or 'https://www.brainbackdoor.com/', url)
            for page in self.pages.values():
                candidates = [page.get('sourceUrl', ''), *page.get('aliases', [])]
                if any(urlsplit(alias).path.rstrip('/') == parsed.path.rstrip('/') for alias in candidates if alias) and page.get('targetPath'):
                    return page['targetPath'] + (f'#{parsed.fragment}' if parsed.fragment else '')
        return urljoin(self.entry.get('sourceUrl') or 'https://www.brainbackdoor.com/', url)

    def rich(self, runs, block_id=''):
        output = []
        for run in runs or []:
            if not isinstance(run, list) or not run: continue
            value = str(run[0]); decorations = run[1] if len(run) > 1 else []
            content = text_escape(value)
            for deco in decorations:
                key = deco[0]
                if key == 'p':
                    mentioned = canonical_id(deco[1]); linked = self.blocks.get(mentioned, {})
                    page = self.pages.get(mentioned, {})
                    title = page.get('title') or plain(linked.get('properties', {}).get('title'))
                    if not title:
                        title = '원본 페이지 ↗'
                        self.issue('unresolved-page-mention-title', block_id, sourceId=mentioned)
                    href = self.target(f'https://www.brainbackdoor.com/{mentioned}', block_id)
                    content = f'<a href="{attr(href)}">{text_escape(title)}</a>'
                elif key == 'a':
                    href = self.target(deco[1], block_id)
                    if href: content = f'<a href="{attr(href)}">{content}</a>'
                elif key == 'b': content = f'<strong>{content}</strong>'
                elif key == 'i': content = f'<em>{content}</em>'
                elif key == 's': content = f'<s>{content}</s>'
                elif key == '_': content = f'<u>{content}</u>'
                elif key == 'c': content = f'<code>{content}</code>'
                elif key == 'h':
                    color = re.sub('[^a-z_]', '', str(deco[1]))
                    content = f'<span className="notion-color-{color}">{content}</span>'
                elif key == 'e': content = f'<code className="notion-equation">{text_escape(deco[1])}</code>'
                elif key == 'd' and isinstance(deco[1], dict):
                    data = deco[1]; label = data.get('start_date', value)
                    if data.get('start_time'): label += ' ' + data['start_time']
                    if data.get('end_date'): label += ' – ' + data['end_date']
                    if data.get('end_time'): label += ' ' + data['end_time']
                    content = f'<time>{text_escape(label)}</time>'
                elif key == 'u':
                    user = self.props['recordMap'].get('notion_user', {}).get(deco[1], {}).get('value', {})
                    name = user.get('name') or ' '.join(filter(None, [user.get('given_name'), user.get('family_name')]))
                    if name: content = text_escape(name)
                    else: self.issue('unresolved-user-mention', block_id)
                elif key not in ['b','i','s','_','c','h','a','p','e','d','u']:
                    self.issue('unsupported-decoration', block_id, decoration=key)
            output.append(content)
        return ''.join(output)

    def anchor(self, block_id):
        self.used_ids[block_id] += 1
        return block_id if self.used_ids[block_id] == 1 else f'{block_id}-copy-{self.used_ids[block_id]}'

    def asset(self, url, block_id, suffix=''):
        if not url: return ''
        key = (url, block_id, suffix)
        if key in self.assets: return self.assets[key]['localPath']
        filebase = block_id + (f'-{suffix}' if suffix else '')
        extension_match = re.search(r'\.([a-zA-Z0-9]{1,6})$', unquote(urlsplit(url).path))
        guessed = '.' + extension_match.group(1).lower() if extension_match else ''
        if not re.fullmatch(r'\.[a-z0-9]{1,6}', guessed): guessed = ''
        record = {'blockId': block_id, 'sourceUrl': url, 'localPath': f'/content/{self.page_id}/{filebase}{guessed or ".bin"}', 'status': 'pending'}
        self.assets[key] = record
        self.report['assets'].append(record)
        if not self.download:
            record['status'] = 'not-downloaded'
            return record['localPath']
        folder = self.output_root / 'public' / 'content' / self.page_id
        folder.mkdir(parents=True, exist_ok=True)
        existing = sorted(folder.glob(filebase + '.*'))
        if existing and existing[0].stat().st_size:
            target = existing[0]; data = target.read_bytes()
            record.update(status='downloaded', localPath='/' + str(target.relative_to(self.output_root / 'public')), bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
            dimensions=image_dimensions(str(target))
            if dimensions: record.update(width=dimensions[0],height=dimensions[1])
            return record['localPath']
        candidates = [url] if url.startswith(('https://','http://')) else []
        original_public = self.public_media.get((block_id,url))
        if original_public: candidates.insert(0,original_public)
        if 'notion-static.com' in url or 'prod-files-secure' in url or url.startswith('attachment:') or suffix == 'cover':
            route = 'fileUrl' if guessed in ['.mp4','.webm','.mov','.pdf','.xlsx','.xls','.zip','.csv','.mp3','.m4a','.wav'] else 'image'
            oopy = f'https://oopy.lazyrockets.com/api/v2/notion/{route}?src={quote(url,safe="")}&blockId={block_id}'
            if oopy not in candidates: candidates.insert(0,oopy)
            candidates.append(f'https://www.notion.so/image/{quote(url, safe="")}?table=block&id={block_id}&cache=v2')
        errors = []
        for candidate in candidates:
            for attempt in range(2):
                try:
                    request = Request(candidate, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.brainbackdoor.com/'})
                    with urlopen(request, timeout=30) as response:
                        data = response.read(); mime = response.headers.get_content_type()
                    if not data: raise ValueError('empty response')
                    if mime in ['text/html','application/json'] and guessed not in ['.html','.json']:
                        raise ValueError(f'unexpected {mime}')
                    mime_ext = mimetypes.guess_extension(mime)
                    ext = (mime_ext if mime.startswith(('image/','video/','audio/')) else guessed) or guessed or mime_ext or '.bin'
                    if ext == '.jpe': ext = '.jpg'
                    target = folder / (filebase + ext)
                    target.write_bytes(data)
                    record.update(status='downloaded', localPath='/' + str(target.relative_to(self.output_root / 'public')), bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), contentType=mime)
                    dimensions=image_dimensions(str(target))
                    if dimensions: record.update(width=dimensions[0],height=dimensions[1])
                    return record['localPath']
                except Exception as exc:
                    errors.append(type(exc).__name__ + ': ' + str(exc).split('?')[0])
                    if getattr(exc,'code',None) in [400,401,403,404,410]: break
        record.update(status='failed', errors=errors, localPath=url)
        self.issue('asset-download-failed', block_id, sourceUrl=url)
        return url

    def block(self, block_id, ancestors=()):
        block_id = canonical_id(block_id)
        if block_id in ancestors:
            self.issue('cyclic-block', block_id); return ''
        b = self.blocks.get(block_id)
        if not b:
            self.issue('missing-block', block_id); return ''
        if b.get('role') == 'none' and not b.get('type'):
            self.issue('inaccessible-source-block',block_id)
            return f'<p><a href="https://www.brainbackdoor.com/{block_id}">https://www.brainbackdoor.com/{block_id}</a></p>\n\n'
        typ = b.get('type', 'unknown'); props = b.get('properties') or {}; fmt = b.get('format') or {}
        if self.legacy_navigation(b):
            self.exclude_navigation(block_id, block_id)
            return ''
        title = props.get('title', []); raw = plain(title)
        text = self.rich(title, block_id); anchor = self.anchor(block_id)
        child_ids = b.get('content', []); ancestry = (*ancestors, block_id)
        record = {'sourceBlockId': block_id, 'type': typ, 'sourceTextChars': len(raw), 'sourceTextSha256': hashlib.sha256(raw.encode()).hexdigest(), 'status': 'converted'}
        self.report['blocks'].append(record)
        children = lambda: self.group(child_ids, ancestry)
        exclusion = self.hidden_configuration(block_id, b)
        if exclusion:
            record['status'] = 'excluded-oopy-configuration'
            self.report['excluded'].append({'sourceBlockId': block_id, 'type': typ, 'reason': exclusion})
            if block_id=='a1380db4-7fef-4cd0-abc2-36c0a7d28322':
                record['status']='rendered-source-html-links'
                class OriginalLinks(HTMLParser):
                    def __init__(self): super().__init__(); self.links=[]; self.current=None
                    def handle_starttag(self,tag,attrs):
                        if tag=='a': self.current=[dict(attrs).get('href',''),'']
                    def handle_data(self,data):
                        if self.current is not None: self.current[1]+=data
                    def handle_endtag(self,tag):
                        if tag=='a' and self.current is not None: self.links.append(self.current); self.current=None
                parser=OriginalLinks(); parser.feed(raw)
                record['preservedLinks']=[{'sourceUrl':url,'label':label} for url,label in parser.links]
                return f'<div id="{anchor}">\n\n'+''.join(f'<p><a href="{attr(self.target(url,block_id))}">{text_escape(label)}</a></p>\n\n' for url,label in parser.links)+'</div>\n\n'+children()
            return children()
        if typ == 'text':
            return (f'<p id="{anchor}">{text}</p>\n\n' if text else '') + children()
        if typ in ['header','sub_header','sub_sub_header']:
            level = ['header','sub_header','sub_sub_header'].index(typ) + 1 - self.heading_min + 2
            return f'<span id="{anchor}"></span>\n\n' + '#' * level + f' {text}\n\n' + children()
        if typ in ['bulleted_list','numbered_list','to_do']:
            if typ == 'to_do':
                checked = plain(props.get('checked')) == 'Yes'
                text = f'<label><input type="checkbox" checked={{{str(checked).lower()}}} disabled /> {text}</label>'
            return f'<li id="{anchor}">\n\n<p>{text}</p>\n\n{children()}</li>\n\n'
        if typ == 'code':
            source_lang = plain(props.get('language', [['Plain Text']]))
            lang = LANGUAGES.get(source_lang.lower(), 'text')
            if lang == 'text' and source_lang.lower() not in ['plain text','plaintext','text']:
                self.issue('code-language-fallback', block_id, language=source_lang)
            record['language'] = source_lang; record['renderLanguage'] = lang
            max_ticks = max([len(m.group()) for m in re.finditer('`+', raw)] or [0]); fence = '`' * max(3,max_ticks+1)
            caption = self.rich(props.get('caption'), block_id)
            return f'<span id="{anchor}"></span>\n\n{fence}{lang}\n{raw}\n{fence}\n\n' + (f'<p className="notion-caption">{caption}</p>\n\n' if caption else '') + children()
        if typ == 'quote': return f'<blockquote id="{anchor}">\n\n<p>{text}</p>\n\n{children()}</blockquote>\n\n'
        if typ == 'callout':
            icon = fmt.get('page_icon','')
            if icon.startswith(('http','attachment:')):
                icon_url=self.asset(icon,block_id,'icon')
                icon = f'<img className="notion-callout-icon" src="{attr(icon_url)}"{local_image_attributes(icon_url,self.output_root)} alt="" />'
            else: icon = text_escape(icon)
            return f'<blockquote id="{anchor}" className="notion-callout">\n\n<p>{icon} {text}</p>\n\n{children()}</blockquote>\n\n'
        if typ == 'toggle': return f'<details id="{anchor}" className="notion-toggle" open>\n\n<summary>{text}</summary>\n\n{children()}</details>\n\n'
        if typ == 'divider': return f'<hr id="{anchor}" />\n\n'
        if typ in ['column_list','column']:
            cls = 'notion-columns' if typ == 'column_list' else 'notion-column'
            return f'<div id="{anchor}" className="{cls}">\n\n{children()}</div>\n\n'
        if typ == 'table_of_contents':
            record['status'] = 'replaced-by-site-toc'
            self.report['excluded'].append({'sourceBlockId': block_id, 'type': typ, 'reason': 'Replaced by the site table of contents generated from the preserved headings.'})
            return ''
        if typ == 'image':
            source = plain(props.get('source')) or fmt.get('display_source','')
            local = self.asset(source, block_id); caption = self.rich(props.get('caption'), block_id)
            alt_text = plain(props.get('caption'))
            return f'<figure id="{anchor}" className="notion-figure">\n\n<img src="{attr(local)}"{local_image_attributes(local,self.output_root)} alt="{attr(alt_text)}" loading="lazy" />' + (f'<figcaption>{caption}</figcaption>' if caption else '') + '\n\n</figure>\n\n' + children()
        if typ in ['file','pdf','audio','video','embed','bookmark','maps','figma','gist','tweet','drive']:
            source = plain(props.get('source')) or plain(props.get('link')) or fmt.get('display_source','')
            caption = self.rich(props.get('caption'), block_id); description = self.rich(props.get('description'),block_id)
            downloadable = typ in ['file','pdf','audio'] or (typ == 'video' and re.search(r'\.(mp4|webm|mov)(\?|$)',source,re.I))
            href = self.asset(source,block_id) if downloadable else self.target(source,block_id)
            label = text or text_escape(source)
            media = ''
            if typ == 'audio': media = f'<audio controls src="{attr(href)}" />\n'
            if typ == 'video' and href.startswith('/content/'): media = f'<video controls preload="metadata" src="{attr(href)}" />\n'
            embed = fmt.get('display_source') or ''
            match = re.search(r'(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/))([\w-]{11})',source)
            if match: embed = f'https://www.youtube-nocookie.com/embed/{match.group(1)}'
            if not embed and typ in ['embed','video','maps','figma','gist','tweet','drive'] and source.startswith('https://') and not media: embed = source
            if embed and urlsplit(embed).scheme == 'https':
                media += f'<iframe src="{attr(embed)}" title="{attr(plain(title) or plain(props.get("caption")) or source)}" loading="lazy" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />\n'
            elif typ in ['embed','video','maps','figma','gist','tweet','drive'] and not media:
                record['status'] = 'preserved-link-fallback'; self.issue('embed-link-fallback',block_id,sourceUrl=source)
            cover = fmt.get('bookmark_cover')
            if cover:
                local_cover=self.asset(cover,block_id,'cover')
                cover_record=self.assets[(cover,block_id,'cover')]
                if typ=='bookmark' and cover_record['status']=='failed':
                    cover_record['renderPolicy']='unavailable bookmark preview omitted; title/description/link retained'
                else:
                    media += f'<img className="notion-bookmark-cover" src="{attr(local_cover)}"{local_image_attributes(local_cover,self.output_root)} alt="" loading="lazy" />\n'
            link = f'<p><a href="{attr(href)}">{label}</a></p>' if href else (f'<p>{label}</p>' if label else '')
            return f'<figure id="{anchor}" className="notion-{typ}">\n\n{media}{link}' + (f'<p>{description}</p>' if description else '') + (f'<figcaption>{caption}</figcaption>' if caption else '') + '\n\n</figure>\n\n' + children()
        if typ == 'external_object_instance':
            source = fmt.get('original_url') or fmt.get('uri','')
            attrs = fmt.get('attributes', [])
            title_attr = next((a for a in attrs if a.get('id') == 'title'), {})
            label = ' '.join(str(v) for v in title_attr.get('values', [])) or source
            details=[]
            for item in attrs:
                if item.get('id') == 'title': continue
                values=[]
                for value in item.get('values', []):
                    if isinstance(value, dict):
                        value = ' '.join(str(value[k]) for k in ['start_date','start_time','end_date','end_time','time_zone'] if value.get(k))
                    values.append(text_escape(value))
                details.append(f'<dt>{text_escape(item.get("name", item.get("id", "")))}</dt><dd>{" · ".join(values)}</dd>')
            return f'<figure id="{anchor}" className="notion-bookmark"><p><a href="{attr(self.target(source,block_id))}">{text_escape(label)}</a></p><dl>{"".join(details)}</dl></figure>\n\n'
        if typ in ['collection_view', 'collection_view_page']:
            collection_id = canonical_id(b.get('collection_id') or fmt.get('collection_pointer',{}).get('id',''))
            collection = self.collections.get(collection_id,{})
            schema = collection.get('schema',{})
            view_id = (b.get('view_ids') or [''])[0]
            view = self.views.get(canonical_id(view_id),{})
            viewfmt = view.get('format',{})
            prop_options = viewfmt.get(f'{view.get("type","table")}_properties') or viewfmt.get('table_properties') or []
            columns = [p['property'] for p in prop_options if p.get('visible',True) and p.get('property') in schema]
            if not columns: columns = sorted(schema, key=lambda key: key != 'title')
            if 'title' in schema and 'title' not in columns: columns.insert(0,'title')
            query = (self.props.get('queryCollectionResult') or {}).get(view_id) or {}
            row_ids=[]; row_groups={}
            def find_rows(value):
                if isinstance(value,dict):
                    for key, child in value.items():
                        if key == 'blockIds' and isinstance(child,list):
                            for row_id in child:
                                if row_id not in row_ids: row_ids.append(row_id)
                        elif key != 'recordMap': find_rows(child)
                elif isinstance(value,list):
                    for child in value: find_rows(child)
            board = ((query.get('result') or {}).get('reducerResults') or {}).get('board_columns')
            if board:
                # Only actual visible query groups are public content. Alternate
                # view page_sort can contain private or stale card identifiers.
                for group in board.get('results', []):
                    if not group.get('visible', True): continue
                    value = group.get('value', {})
                    key = f'{value.get("type", "")}:{value.get("value", "")}'
                    ids = board.get('blockResults', {}).get(key, {}).get('blockIds', [])
                    for rid in ids:
                        if rid not in row_ids: row_ids.append(rid)
                        row_groups[canonical_id(rid)] = str(value.get('value', ''))
            else:
                find_rows(query.get('result',{}))
            verified_rows = next((item for item in self.entry.get('collectionRows',[]) if item.get('viewId') == view_id and item.get('complete')),None)
            if verified_rows is not None: row_ids = verified_rows['sourceIds']
            record['viewId'] = view_id; record['sourceRowIds'] = row_ids
            if not row_ids:
                if verified_rows is not None:
                    record['status'] = 'verified-empty-source-collection'
                    record['evidence'] = verified_rows.get('evidence')
                else:
                    self.issue('empty-or-unavailable-collection',block_id,collectionId=collection_id)
            head=''.join(f'<th scope="col">{text_escape(schema[key].get("name",key))}</th>' for key in columns)
            rows=[]; previous_group=None
            for row_id in row_ids:
                row_id=canonical_id(row_id); row=self.blocks.get(row_id,{})
                if row_id in row_groups and row_groups[row_id] != previous_group:
                    previous_group=row_groups[row_id]
                    rows.append(f'<tr className="notion-collection-group"><th colSpan={{{max(1,len(columns))}}}>{text_escape(previous_group)}</th></tr>')
                rowprops=row.get('properties',{}); rowanchor=self.anchor(row_id); cells=[]
                rowentry=self.pages.get(row_id,{})
                source_text=''.join(plain(rowprops.get(key)) for key in columns)
                self.report['blocks'].append({'sourceBlockId':row_id,'type':'collection_row','sourceTextChars':len(source_text),'sourceTextSha256':hashlib.sha256(source_text.encode()).hexdigest(),'status':'converted','visibleProperties':columns})
                for key in columns:
                    value=self.rich(rowprops.get(key),row_id)
                    if schema[key].get('type')=='checkbox': value='<input type="checkbox" disabled checked={' + str(plain(rowprops.get(key))=='Yes').lower() + '} />'
                    row_cover=(row.get('format') or {}).get('page_cover')
                    if key=='title' and row_cover and view.get('type')=='gallery':
                        cover_path=self.asset(row_cover,row_id,'cover')
                        value=f'<img className="notion-collection-cover" src="{attr(cover_path)}"{local_image_attributes(cover_path,self.output_root)} alt="" loading="lazy" />'+value
                    if key=='title':
                        link = rowentry.get('targetPath') if rowentry.get('kind')=='post' else None
                        oopy_property = next((prop for prop,data in schema.items() if data.get('name')=='oopy' and data.get('type')=='url'),None)
                        if oopy_property and plain(rowprops.get(oopy_property)):
                            link = self.target(plain(rowprops[oopy_property]),row_id)
                        if link: value=f'<a href="{attr(link)}">{value}</a>'
                    cells.append(f'<td>{value}</td>')
                rows.append(f'<tr id="{rowanchor}">'+''.join(cells)+'</tr>')
                if rowentry.get('kind') != 'post' and row.get('content'):
                    inner=self.group(row['content'],(*ancestry,row_id))
                    if inner: rows.append(f'<tr>\n\n<td colSpan={{{max(1,len(columns))}}}>\n\n{inner}</td>\n\n</tr>')
            name=self.rich(collection.get('name'),block_id)
            caption=f'<caption>{name}</caption>' if name else ''
            return f'<div id="{anchor}" className="notion-table-scroll">\n\n<table>\n\n{caption}\n\n<thead><tr>{head}</tr></thead>\n\n<tbody>\n\n' + '\n\n'.join(rows) + '\n\n</tbody>\n\n</table>\n\n</div>\n\n'
        if typ == 'table':
            order = fmt.get('table_block_column_order', []); rows=[]
            rowheader=fmt.get('table_block_row_header',False); colheader=fmt.get('table_block_column_header',False)
            for i, row_id in enumerate(child_ids):
                row=self.blocks.get(canonical_id(row_id),{}); rowprops=row.get('properties',{})
                cols=order or list(rowprops)
                cells=[]
                for j,key in enumerate(cols):
                    tag='th' if (colheader and i==0) or (rowheader and j==0) else 'td'
                    scope=' scope="col"' if colheader and i==0 else ' scope="row"' if rowheader and j==0 else ''
                    cells.append(f'<{tag}{scope}>{self.rich(rowprops.get(key),row_id)}</{tag}>')
                rows.append('<tr>' + ''.join(cells) + '</tr>')
                source_text=''.join(plain(rowprops.get(key)) for key in cols)
                self.report['blocks'].append({'sourceBlockId':row_id,'type':'table_row','sourceTextChars':len(source_text),'sourceTextSha256':hashlib.sha256(source_text.encode()).hexdigest(),'status':'converted'})
            body = ('<thead>'+rows[0]+'</thead><tbody>'+''.join(rows[1:])+'</tbody>') if colheader and rows else '<tbody>'+''.join(rows)+'</tbody>'
            return f'<div className="notion-table-scroll"><table id="{anchor}">{body}</table></div>\n\n'
        if typ == 'equation': return f'<pre id="{anchor}" className="notion-equation"><code>{text_escape(raw)}</code></pre>\n\n'
        if typ in ['page','link_to_page']:
            page_id = canonical_id(fmt.get('link_to_page_id') or b.get('id'))
            href=self.target(f'https://www.brainbackdoor.com/{page_id}',block_id)
            label=text or text_escape(self.pages.get(page_id,{}).get('title') or href)
            return f'<p id="{anchor}"><a href="{attr(href)}">{label}</a></p>\n\n'
        if typ in ['alias','transclusion_reference']:
            pointer=fmt.get('alias_pointer') or fmt.get('transclusion_reference_pointer') or {}
            referenced=pointer.get('id')
            if referenced: return self.block(referenced,ancestry)
        if typ == 'transclusion_container': return children()
        self.issue('unsupported-block-type',block_id,type=typ)
        record['status']='preserved-content-fallback'
        return (f'<p id="{anchor}">{text}</p>\n\n' if text else '') + children()

    def group(self, ids, ancestors=()):
        output=[]; list_type=None
        types={'bulleted_list':'ul','numbered_list':'ol','to_do':'ul'}
        for block_id in ids:
            typ=self.blocks.get(canonical_id(block_id),{}).get('type')
            current=typ if typ in types else None
            if current != list_type:
                if list_type: output.append(f'</{types[list_type]}>\n\n')
                if current: output.append(f'<{types[current]}' + (' className="notion-todo-list"' if current=='to_do' else '') + '>\n\n')
                list_type=current
            output.append(self.block(block_id,ancestors))
        if list_type: output.append(f'</{types[list_type]}>\n\n')
        return ''.join(output)

    def description(self):
        def candidates(ids):
            for block_id in ids:
                block=self.blocks.get(canonical_id(block_id),{}); raw=plain(block.get('properties',{}).get('title')).strip()
                if self.legacy_navigation(block): continue
                hidden=self.hidden_configuration(canonical_id(block_id),block)
                if not hidden and block.get('type') in ['text','quote','callout','bulleted_list','numbered_list'] and raw and '‣' not in raw and not re.match(r'^[⬅➡←→]|.*(?:이전 글|다음 글)',raw):
                    yield raw
                if block.get('type') not in ['page','table_of_contents']:
                    yield from candidates(block.get('content',[]))
        first=next(candidates(self.root.get('content',[])), '')
        return re.split(r'(?<=[.!?。])\s+',first,maxsplit=1)[0]

    def convert(self):
        title=self.entry.get('title') or plain(self.root.get('properties',{}).get('title'))
        date=self.entry.get('pubDate') or source_date(self.root)[0]
        if not date: raise ValueError(f'No supported publication date for {self.page_id}')
        source_url=self.entry.get('sourceUrl') or f'https://www.brainbackdoor.com/{self.page_id}'
        metadata={'title':title,'description':self.description(),'pubDate':date,'category':self.entry.get('category','infra'),'tags':self.entry.get('tags',[]),'sourceId':self.page_id,'sourceUrl':source_url}
        evidence=self.entry.get('pubDateEvidence') or {}
        metadata['dateSource']='created' if isinstance(evidence,dict) and (evidence.get('kind')=='notion_created_time_fallback' or evidence.get('propertyName')=='생성일') else 'published'
        icon=self.root.get('format',{}).get('page_icon','')
        if icon and not icon.startswith(('http','attachment:')): metadata['icon']=icon
        cover=self.root.get('format',{}).get('page_cover')
        if cover: metadata['image']=self.asset(cover,self.page_id,'cover')
        body=self.group(self.root.get('content',[]),(self.page_id,))
        if self.entry.get('slug')=='tcp-error-recovery':
            body='import TcpRecoveryFigure from "../../../components/figures/TcpRecoveryFigure";\n\n<TcpRecoveryFigure client:visible />\n\n'+body
        front='---\n' + '\n'.join(f'{key}: {json.dumps(value,ensure_ascii=False)}' for key,value in metadata.items()) + '\n---\n\n'
        self.report['title']=title; self.report['pubDate']=date; self.report['pubDateEvidence']=self.entry.get('pubDateEvidence') or source_date(self.root)[1]
        self.report['summary']={'blockCount':len(self.report['blocks']),'typeCounts':dict(Counter(b['type'] for b in self.report['blocks'])),'assetCount':len(self.report['assets']),'failedAssets':sum(a['status']=='failed' for a in self.report['assets']),'warningCount':len(self.report['warnings']),'unresolvedLinkCount':len(self.report['unresolvedLinks'])}
        return (front+body).rstrip()+'\n'


def refresh_image_dimensions(report_path):
    """Update existing output in place; no source conversion or network calls."""
    count=0; missing=[]
    for path in (REPO/'src/content/posts/ko').glob('*.mdx'):
        def update(match):
            nonlocal count
            tag=match.group(); source=re.search(r'\bsrc="([^"]+)"',tag)
            if not source: return tag
            url=html.unescape(source.group(1))
            if not url.startswith('/content/'): return tag
            dimensions=local_image_attributes(url)
            if not dimensions:
                missing.append({'file':str(path.relative_to(REPO)),'source':url}); return tag
            tag=re.sub(r'\s(?:width|height)="[^"]*"','',tag)
            count+=1
            return re.sub(r'\s*/?>$',dimensions+' />',tag)
        source=path.read_text(); result=re.sub(r'<img\b[^>]*>',update,source)
        if result!=source: path.write_text(result)
    if report_path.exists():
        report=json.loads(report_path.read_text())
        for page in report.get('pages',[]):
            for asset in page.get('assets',[]):
                if asset.get('status')!='downloaded': continue
                dimensions=image_dimensions(str(REPO/'public'/asset['localPath'].lstrip('/')))
                if dimensions: asset.update(width=dimensions[0],height=dimensions[1])
        report['imageDimensions']={'updatedImages':count,'missing':missing,'method':'Original local PNG/JPEG/GIF/WebP headers; no image re-encoding.'}
        report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'updatedImages':count,'missing':missing},ensure_ascii=False))
    return 1 if missing else 0


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory',type=Path,default=REPO/'docs/migration-inventory.json')
    parser.add_argument('--source',type=Path)
    parser.add_argument('--only',action='append',default=[])
    parser.add_argument('--no-download',action='store_true')
    parser.add_argument('--workers',type=int,default=5)
    parser.add_argument('--report',type=Path,default=REPO/'docs/migration-conversion-report.json')
    parser.add_argument('--refresh-image-dimensions',action='store_true',help='Only add intrinsic size to existing local img elements; never download assets.')
    args=parser.parse_args()
    if args.refresh_image_dimensions: return refresh_image_dimensions(args.report)
    inventory=json.loads(args.inventory.read_text())['pages'] if args.inventory.exists() else []
    if args.source:
        source=json.loads(args.source.read_text()); page_id=canonical_id(source['pageID'])
        entry=next((p for p in inventory if canonical_id(p['sourceId'])==page_id),None)
        if not entry:
            root=source['recordMap']['block'][page_id]['value']; date,evidence=source_date(root)
            entry={'sourceId':page_id,'title':plain(root.get('properties',{}).get('title')),'sourceUrl':f'https://www.brainbackdoor.com/{page_id}','slug':'tcp-error-recovery' if page_id=='5df70731-ea29-47b1-bff3-9f18e8ff955f' else page_id,'category':'infra','pubDate':date,'pubDateEvidence':evidence,'kind':'post'}
            entry['targetPath']='/posts/'+entry['slug']; inventory.append(entry)
        entry['sourcePath']=str(args.source); selected=[entry]
    else:
        selected=[p for p in inventory if p.get('kind')=='post' and (not args.only or p['sourceId'] in args.only or p.get('slug') in args.only)]
    old={}
    if args.report.exists(): old={p['sourceId']:p for p in json.loads(args.report.read_text()).get('pages',[])}
    def execute(entry):
        try:
            source=json.loads(Path(entry['sourcePath']).read_text())
            converter=Converter(source,entry,inventory,download=not args.no_download)
            mdx=converter.convert(); target=REPO/'src/content/posts/ko'/f'{entry["slug"]}.mdx'; target.write_text(mdx)
            converter.report['outputFile']=str(target.relative_to(REPO)); converter.report['status']='converted'
            print(json.dumps({'sourceId':entry['sourceId'],'title':entry['title'],**converter.report['summary']},ensure_ascii=False),flush=True)
            return converter.report
        except Exception as exc:
            print(json.dumps({'sourceId':entry['sourceId'],'error':str(exc)},ensure_ascii=False),file=sys.stderr,flush=True)
            return {'sourceId':entry['sourceId'],'status':'failed','error':str(exc)}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for report in pool.map(execute,selected): old[report['sourceId']]=report
    result={'version':1,'generatedAt':datetime.now(timezone.utc).isoformat(),'sourceSnapshots':'Cached outside the repository','pages':list(old.values())}
    args.report.parent.mkdir(parents=True,exist_ok=True); args.report.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    return 1 if any(p['status']=='failed' for p in result['pages']) else 0

if __name__=='__main__': raise SystemExit(main())
