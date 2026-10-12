#!/usr/bin/env python3
"""Inventory only pages linked from the public blog; raw data stays in /tmp.

Run: python3 scripts/migration/collect.py [--extra-seeds PATH] [--refresh]
An extra-seeds JSON file may contain public page URLs observed in a fully
expanded collection. It is evidence from the public list, not a page-ID scan.
"""
from __future__ import annotations

import argparse
from collections import Counter, deque
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from urllib.robotparser import RobotFileParser
import uuid

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path('/private/tmp/brainbackdoor-migration/pages')
MANIFEST = ROOT / 'docs/migration-inventory.json'
SITE = 'https://www.brainbackdoor.com'
HOSTS = {'www.brainbackdoor.com', 'brainbackdoor.com'}
AGENT = 'Mozilla/5.0 (compatible; personal-site-migration)'
UUID_RE = re.compile(r'^[0-9a-fA-F]{32}$|^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$')
HOME_ID = '106f0c57-b687-4361-b71b-6c8c84378112'
INFRA_ID = '7630bf78-955c-44ca-a8ca-4e12048e1471'
RETRO_ID = 'cf5a88f2-4901-4d58-8f48-100e720c27f9'
ABOUT_ID = '5671f256-dc74-414a-bc7e-6657e3b0aa82'
POST_COLLECTION_ID = '30023289-59b6-47ee-bae8-52510651466f'
PROJECT_REFERENCE_IDS = {'1c790d37-083f-80e3-aeed-c41e19904cc8'}
DIARY_ID = '9a393b4d-ea51-45d2-8823-50eb9e522ff9'
DIARY_VIEW_ID = '239e4626-e27c-4a5b-a2f9-5af45f2140c5'
BABY_ID = '0a7765e4-92de-4182-bc0e-0d55dfb13ab0'
BABY_VIEWS = [('d4e5498c-51a5-4b03-80eb-edf1119968db', 7), ('b6f7f1e7-dc22-46b8-80fb-91c6d5d8d15c', 1)]
TEMPLATE_ID = 'a1094dc5-8f5c-4725-be7c-8247fc273c44'
TEMPLATE_VIEWS = [
    ('b8e1b765-90e6-4ca1-ae65-003bcb029f2a', ['0c1677e7-98b8-4e6f-8d41-2a9a5004932b', '29698c2c-e60f-4c50-8dea-15c2337cd50c']),
    ('32390019-be90-45de-9c96-0a0dcc1e41a4', ['b5e634cc-2228-41a4-9c13-c9dd7c59b7c3', '18495cc6-fd6d-4b7a-bd41-35c7f9615636']),
    ('60e0bc6e-c780-4d0f-b390-961e9159ad2f', []),
    ('5114e574-60b9-4a99-8589-bec8de400dce', ['3f0d1340-bfd8-4c6b-8a0f-40d492afc7eb']),
]
TEMPLATE_COLLECTIONS = {'213b91f1-3bb8-4476-9411-db10d2ff9727', 'c2ef1d50-54dd-489a-b14d-dffb908feaf1', '37629214-6477-4ff0-bdc6-2d4220f4d6c3'}
SLUGS = {
    '5df70731-ea29-47b1-bff3-9f18e8ff955f': 'tcp-error-recovery',
    '38190d37-083f-8033-a7e8-f3996e11cf55': 'springcamp-2026',
    '16b90d37-083f-8025-acc7-e77b4a9e2b32': '2024-retrospect',
}
SEEDS = [('/', 'index'), ('/retrospective', 'retrospect'), ('/infra', 'infra'), ('/profile', 'about')]
# Observed in the public home collection after both Load more actions; 43 rows total.
# Initial HTML already provides the first 25. These are its remaining 18 rows.
EXPANDED_HOME_IDS = [
    '1824fb4e-415b-4a61-8ec4-76e5102ee32f', '623ea5b7-3623-4843-9926-8b29e76b9b71',
    '833771f4-d722-4c80-8967-2f0024885bff', '0f9f8b63-17c1-4475-bfa8-75f0ef0ebcad',
    'a1094dc5-8f5c-4725-be7c-8247fc273c44', '8c882a84-05d4-4058-8ebb-40b5dafe433f',
    '5d9c4e59-60bf-41d0-9d2a-b8125636a9c3', '95248237-c6a4-4489-a51e-6c548c0c103c',
    '1c3f7881-71c5-4855-85d1-a4c7e895a66b', '14b691d7-7fd7-4e95-8787-49e06111755f',
    '04555c7c-eb81-4283-905e-b8f9c3f8b75c', 'beae0ed2-e020-4681-abac-fdb9e5f12c5f',
    '02773af9-5c93-43b5-89b4-bbab94536195', '5df70731-ea29-47b1-bff3-9f18e8ff955f',
    '32fc3a46-6aed-4c92-9896-c40abd86ef06', 'd6132043-4fd1-4960-974c-26946e0224ce',
    '95400228-c9fb-4397-ac45-281f2a6c7446', 'c6550c6d-0773-43bc-84a9-311a3de97b00',
]
# Observed after the diary's Load more action; final public list has 34 rows.
EXPANDED_DIARY_IDS = [
    'df5be165-6aaf-48a1-8e44-98649bf4c2fb', 'a70f48e8-4eaf-4ec7-a776-2fc63a0e8c0b',
    '81a4fa62-4f3e-4fbc-b541-5228ecf8124a', '4a95e723-223d-4b4f-a22d-a0d0d4261e1a',
    'bdb5b0e5-bece-41e6-90d9-518cbb3b08a8', '6349bba8-0f47-486c-a53c-a008b8f8f14e',
    'b163ee50-0b3a-4002-b7b5-9c4f3a1d59a6', 'c47fefa1-9518-4c6b-b017-78e0e39ebece',
    '37f2de15-7220-4861-8401-0f1de81df351',
]


class PublicRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not public_url(newurl):
            raise HTTPError(newurl, code, 'Redirect outside public source scope', headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class NextData(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inside = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == 'script' and dict(attrs).get('id') == '__NEXT_DATA__':
            self.inside = True

    def handle_endtag(self, tag):
        if tag == 'script':
            self.inside = False

    def handle_data(self, data):
        if self.inside:
            self.parts.append(data)


def plain(value):
    return ''.join(str(part[0]) for part in value or [] if isinstance(part, list) and part)


def public_url(value):
    if not isinstance(value, str) or not value or value.startswith('#'):
        return None
    url = urlsplit(urljoin(SITE + '/', value))
    if url.scheme not in {'http', 'https'} or url.hostname not in HOSTS:
        return None
    if url.path.startswith('/_private/') or url.path.startswith(('/api/', '/_next/')):
        return None
    path = url.path or '/'
    token = path.strip('/')
    if UUID_RE.fullmatch(token):
        path = '/' + str(uuid.UUID(token))
    return urlunsplit(('https', 'www.brainbackdoor.com', path.rstrip('/') or '/', '', ''))


def values(record_map, name):
    return {key: item.get('value', item) for key, item in record_map.get(name, {}).items()}


def records(props):
    result = dict(props.get('recordMap', {}).get('block', {}))
    for query in props.get('queryCollectionResult', {}).values():
        if not query:
            continue
        result.update(query.get('recordMap', {}).get('block', {}))
    return {key: item.get('value', item) for key, item in result.items()}


def query_rows(result):
    """Public query results include both table rows and grouped board columns.

    Never use collection_view.page_sort: it can retain deleted/private rows.
    """
    ids = []
    has_more = False

    def walk(node):
        nonlocal has_more
        if isinstance(node, dict):
            ids.extend(node.get('blockIds', []))
            has_more = has_more or node.get('hasMore', False)
            for key, value in node.items():
                if key != 'blockIds':
                    walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(result)
    return list(dict.fromkeys(ids)), has_more


def date_info(props, root):
    schema = (props.get('publicPageData') or {}).get('collectionSchema') or {}
    collection = values(props.get('recordMap', {}), 'collection').get(root.get('parent_id'), {})
    schema = {**collection.get('schema', {}), **schema}
    for key, value in root.get('properties', {}).items():
        for part in value:
            for annotation in part[1] if len(part) > 1 else []:
                if annotation[0] == 'd' and isinstance(annotation[1], dict):
                    date = annotation[1].get('start_date')
                    if date:
                        return date, {'kind': 'notion_date_property', 'propertyId': key,
                                      'propertyName': schema.get(key, {}).get('name'), 'value': date}
    if root.get('created_time'):
        created = datetime.fromtimestamp(root['created_time'] / 1000, timezone.utc).isoformat()
        return created, {'kind': 'notion_created_time_fallback', 'value': root['created_time'],
                         'note': 'No authored publication date property; Notion creation time, not a verified original publication date.'}
    return None, {'kind': 'unavailable'}


def rich_links(value):
    for part in value or []:
        if not isinstance(part, list) or len(part) < 2:
            continue
        for mark in part[1]:
            if mark[0] == 'a' and len(mark) > 1:
                yield mark[1]
            elif mark[0] == 'p' and len(mark) > 1:
                yield '/' + mark[1]


def body_and_links(props):
    """Follow only root descendants, their explicit page links, and their views."""
    blocks = records(props)
    seen = set()
    links, external, body, incomplete = [], [], [], []

    def link(raw):
        normalized = public_url(raw)
        if normalized:
            links.append(normalized)
        elif isinstance(raw, str) and raw.startswith(('https://', 'http://')):
            external.append(raw)

    def walk(block_id, root=False):
        if block_id in seen:
            return
        seen.add(block_id)
        block = blocks.get(block_id)
        if not block:
            return
        if not root and block.get('type') in {'page', 'collection_view_page'}:
            link('/' + block_id)
            return
        body.append(block)
        for rich in block.get('properties', {}).values():
            for raw in rich_links(rich):
                link(raw)
        if block.get('type') in {'bookmark', 'link_preview'}:
            link(plain(block.get('properties', {}).get('link')))
        if block.get('type') in {'alias', 'link_to_page'}:
            pointer = block.get('format', {}).get('alias_pointer', {})
            if pointer.get('id'):
                link('/' + pointer['id'])
        pointer = block.get('format', {}).get('transclusion_reference_pointer', {})
        if pointer.get('id'):
            walk(pointer['id'])
        for view_id in block.get('view_ids', []):
            query = props.get('queryCollectionResult', {}).get(view_id) or {}
            row_ids, has_more = query_rows(query.get('result', {}))
            if has_more:
                incomplete.append({'viewId': view_id, 'loadedCount': len(row_ids)})
            for page_id in row_ids:
                item = blocks.get(page_id, {})
                # Homepage activity cards link to a URL property; they are not posts.
                urls = [plain(v) for k, v in item.get('properties', {}).items()
                        if k != 'title' and plain(v).startswith(('https://', 'http://'))]
                if urls:
                    for raw in urls:
                        link(raw)
                else:
                    link('/' + page_id)
        for child in block.get('content', []):
            walk(child)

    walk(props['pageID'], True)
    return body, sorted(set(links)), sorted(set(external)), incomplete


def classify(source_id, title, origins):
    if source_id == HOME_ID:
        return 'index', None, '/'
    if source_id == RETRO_ID:
        return 'index', 'retrospect', '/posts'
    if source_id == INFRA_ID:
        return 'curriculum', 'infra', '/tech/infra'
    if source_id == ABOUT_ID:
        return 'about', None, '/about'
    if any(origin.get('category') == 'life' for origin in origins) or any(word in title for word in ['육아', '결혼', '웨딩', '청첩', '신혼']):
        category = 'life'
    elif any(word in title for word in ['회고', 'SpringCamp', '일의 감각', '끗과 시작']):
        category = 'retrospect'
    elif any(word in title for word in ['미션', '학습 목표', '가이드', '구성하기', '실행해보기', '학습 테스트']):
        category = 'guide'
    elif any(origin.get('category') == 'retrospect' for origin in origins):
        category = 'retrospect'
    else:
        category = 'infra'
    return 'post', category, '/posts/' + SLUGS.get(source_id, source_id)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--extra-seeds', type=Path)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--limit', type=int, default=180)
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    opener = build_opener(PublicRedirects())
    robots = RobotFileParser()
    robots.parse(opener.open(Request(SITE + '/robots.txt', headers={'User-Agent': AGENT}), timeout=30).read().decode().splitlines())
    cached = {}
    for file in CACHE.glob('*.json'):
        try:
            props = json.loads(file.read_text())
            source_id = props['pageID']
            cached[SITE + '/' + source_id] = props
            slug = props.get('configuration', {}).get('slug')
            if slug:
                cached[SITE + '/' + slug.strip('/')] = props
            if source_id == HOME_ID:
                cached[SITE + '/'] = props
        except (ValueError, KeyError):
            pass
    queue = deque((public_url(path), {'sourceUrl': 'seed', 'category': category}) for path, category in SEEDS)
    queue.extend((SITE + '/' + source_id, {'sourceUrl': 'home-dom-pagination-confirmed', 'category': None})
                 for source_id in EXPANDED_HOME_IDS)
    queue.extend((SITE + '/' + source_id, {'sourceUrl': SITE + '/' + DIARY_ID, 'category': 'life',
                                         'evidence': 'diary-dom-pagination-confirmed'})
                 for source_id in EXPANDED_DIARY_IDS)
    queue.extend((SITE + '/' + source_id, {'sourceUrl': SITE + '/' + TEMPLATE_ID, 'category': 'retrospect',
                                         'evidence': 'team-retro-board-ui-confirmed'})
                 for _, source_ids in TEMPLATE_VIEWS for source_id in source_ids)
    if args.extra_seeds:
        extra = json.loads(args.extra_seeds.read_text())
        for item in extra:
            url = item.get('sourceUrl') if isinstance(item, dict) else item
            queue.append((public_url(url), {'sourceUrl': 'expanded-public-collection', 'category': None}))
    pages, by_url, attempted, failures = {}, {}, set(), []
    last_request = 0

    def save(complete=False):
        ordered = sorted(pages.values(), key=lambda page: (page['kind'] != 'post', page['pubDate'] or '', page['sourceId']))
        collection_evidence = []
        for parent_id in [HOME_ID, DIARY_ID, TEMPLATE_ID, BABY_ID]:
            if parent_id in pages:
                pages[parent_id]['collectionRows'] = []
        for parent_id, view_id, observed_count, extra_ids in [
            (HOME_ID, '21fead12-5671-40ac-aad8-8bbe98238c51', 43, EXPANDED_HOME_IDS),
            (DIARY_ID, DIARY_VIEW_ID, 34, EXPANDED_DIARY_IDS),
            *((TEMPLATE_ID, view_id, len(ids), ids) for view_id, ids in TEMPLATE_VIEWS),
            *((BABY_ID, view_id, count, []) for view_id, count in BABY_VIEWS),
        ]:
            parent_props = cached.get(SITE + '/' + parent_id) or (cached.get(SITE + '/') if parent_id == HOME_ID else {}) or {}
            result = (parent_props.get('queryCollectionResult', {}).get(view_id) or {}).get('result', {})
            initial_ids, _ = query_rows(result)
            source_ids = list(dict.fromkeys(initial_ids + extra_ids))
            row_records = records(parent_props)
            missing = [source_id for source_id in source_ids if source_id not in pages and source_id not in row_records]
            evidence = 'Public list fully expanded in browser; no Load more button remained.'
            if parent_id == TEMPLATE_ID:
                evidence = 'Public template UI confirmed four boards with 2/2/0/1 cards; empty action-plan board verified, stale page_sort ignored.'
            elif parent_id == BABY_ID:
                evidence = 'Public baby UI confirmed a 7-card gallery and a 1-post list, with no view-switch control. Hidden alternate Table view page_sort is not public content.'
            entry = {
                'pageId': parent_id, 'viewId': view_id,
                'evidence': evidence,
                'observedRowCount': observed_count, 'initialHtmlRowCount': len(initial_ids),
                'sourceIds': source_ids, 'missingSourceIds': missing,
                'inlineOnlySourceIds': [source_id for source_id in source_ids if source_id not in pages and source_id in row_records],
                'complete': len(source_ids) == observed_count and not missing,
            }
            collection_evidence.append(entry)
            if parent_id in pages:
                pages[parent_id]['collectionRows'].append(entry)
        manifest = {
            'version': 1, 'sourceSite': SITE,
            'collectionRunComplete': complete,
            'collectedAt': datetime.now(timezone.utc).isoformat(),
            'scope': 'Public root descendants, explicit same-site links, and visible collection results; profile mapped to existing about; no private routes or recordMap-wide page scans.',
            'pages': ordered, 'failures': failures,
            'collectionEvidence': collection_evidence,
            'summary': {'pages': len(ordered), 'byKind': dict(Counter(p['kind'] for p in ordered)),
                        'failedRequests': len(failures)},
        }
        pending = MANIFEST.with_suffix('.json.tmp')
        pending.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        pending.replace(MANIFEST)

    while queue and len(attempted) < args.limit:
        url, origin = queue.popleft()
        if not url:
            continue
        if url in by_url:
            page = pages[by_url[url]]
            if origin not in page['discoveredFrom']:
                page['discoveredFrom'].append(origin)
            continue
        if url in attempted:
            continue
        attempted.add(url)
        if not robots.can_fetch(AGENT, url):
            failures.append({'sourceUrl': url, 'collectionStatus': 'blocked', 'reason': 'robots.txt', 'discoveredFrom': origin})
            continue
        try:
            html = None
            props = None if args.refresh else cached.get(url)
            if props is None:
                time.sleep(max(0, .45 - (time.monotonic() - last_request)))
                last_request = time.monotonic()
                response = opener.open(Request(url, headers={'User-Agent': AGENT}), timeout=40)
                html = response.read().decode('utf-8')
                parsed = NextData()
                parsed.feed(html)
                props = json.loads(''.join(parsed.parts))['props']['pageProps']
                if props.get('authorized') is False or not props.get('pageID') or not props.get('recordMap'):
                    raise PermissionError('Page is not publicly authorized or lacks public content')
            source_id = props['pageID']
            requested_path = urlsplit(url).path
            requested_token = requested_path.strip('/')
            if UUID_RE.fullmatch(requested_token) and str(uuid.UUID(requested_token)) != source_id:
                raise ValueError(f'Public URL returned a different page ({source_id}); soft-404 fallback, not an alias')
            if source_id == HOME_ID and requested_path != '/' and not UUID_RE.fullmatch(requested_token):
                raise ValueError('Public URL returned the home fallback; not a confirmed home alias')
            root = records(props).get(source_id, {})
            if root.get('type') not in {'page', 'collection_view_page'}:
                raise ValueError('Linked target is not a document page')
            if html is not None:
                (CACHE / f'{source_id}.html').write_text(html)
                (CACHE / f'{source_id}.json').write_text(json.dumps(props, ensure_ascii=False))
            cached[url] = props
            cached[SITE + '/' + source_id] = props
            if source_id == HOME_ID:
                cached[SITE + '/'] = props
            aliases = {'/' + source_id, '/' + source_id.replace('-', ''), urlsplit(url).path}
            source_slug = props.get('configuration', {}).get('slug')
            if source_slug:
                aliases.add('/' + source_slug.strip('/'))
            if source_id in pages:
                pages[source_id]['aliases'] = sorted(set(pages[source_id]['aliases']) | aliases)
                pages[source_id]['discoveredFrom'].append(origin)
                for alias in aliases:
                    by_url[SITE + alias] = source_id
                continue
            title = plain(root.get('properties', {}).get('title'))
            pub_date, evidence = date_info(props, root)
            kind, category, target = classify(source_id, title, [origin])
            body, links, external, incomplete = body_and_links(props)
            page = {
                'sourceId': source_id, 'title': title, 'sourceUrl': SITE + '/' + source_id,
                'aliases': sorted(aliases), 'pubDate': pub_date, 'pubDateEvidence': evidence,
                'category': category, 'kind': kind, 'slug': SLUGS.get(source_id, source_id),
                'categoryEvidence': 'Mapped to current site categories from source section, title, and discovery context; not an original Notion category property.',
                'updatedDate': datetime.fromtimestamp(root['last_edited_time'] / 1000, timezone.utc).isoformat() if root.get('last_edited_time') else None,
                'sourceParentId': root.get('parent_id'), 'sourceParentTable': root.get('parent_table'),
                'targetPath': target, 'sourcePath': str(CACHE / f'{source_id}.json'),
                'collectionStatus': 'collected', 'bodyBlockCount': max(0, len(body) - 1),
                'assetCount': sum(block.get('type') in {'image', 'file', 'pdf', 'audio', 'video'} for block in body),
                'blockTypes': dict(Counter(block.get('type') for block in body[1:])),
                'discoveredFrom': [origin], 'outboundPageUrls': links, 'externalLinks': external,
                'incompleteCollections': incomplete,
            }
            pages[source_id] = page
            for alias in aliases:
                by_url[SITE + alias] = source_id
            print(f"{len(pages):3} {kind:10} {title} ({page['bodyBlockCount']} blocks)", flush=True)
            if kind != 'about' and source_id not in PROJECT_REFERENCE_IDS:
                for linked in links:
                    queue.append((linked, {'sourceUrl': page['sourceUrl'], 'category': category}))
            save()
        except (HTTPError, URLError, ValueError, KeyError, PermissionError, TimeoutError) as error:
            status = 'not_found' if isinstance(error, HTTPError) and error.code == 404 or 'fallback' in str(error) else 'blocked' if isinstance(error, PermissionError) or isinstance(error, HTTPError) and error.code in {401, 403} else 'error'
            failures.append({'sourceUrl': url, 'collectionStatus': status, 'reason': str(error), 'discoveredFrom': origin})
            print(f"FAILED {url} {status}: {error}", flush=True)
            save()
    # Reclassify using all known provenance, while keeping paths stable.
    for page in pages.values():
        kind, category, target = classify(page['sourceId'], page['title'], page['discoveredFrom'])
        page.update(kind=kind, category=category, targetPath=target)
        if page['sourceId'] in PROJECT_REFERENCE_IDS:
            page.update(kind='index', targetPath=None, contentRole='project-reference',
                        note='Separate linked project site: preserve the original link; do not import its project internals as blog posts.')
        elif page.get('sourceParentTable') == 'collection' and page.get('sourceParentId') != POST_COLLECTION_ID:
            only_bookmarks = set(page['blockTypes']) <= {'bookmark'}
            template_person = page.get('sourceParentId') in TEMPLATE_COLLECTIONS
            diary_entry = page.get('sourceParentId') == '99ad2789-c50e-47d8-896b-223e0288d4c2'
            if page['bodyBlockCount'] == 0 or only_bookmarks or template_person or diary_entry:
                parent = next((pages.get(urlsplit(o['sourceUrl']).path.strip('/'))
                               for o in page['discoveredFrom']
                               if pages.get(urlsplit(o['sourceUrl']).path.strip('/'))), None)
                if parent:
                    page.update(kind='index', contentRole='collection-item',
                                embedding={'parentId': parent['sourceId'], 'anchor': page['sourceId']},
                                targetPath='/posts/' + parent['slug'] + '#' + page['sourceId'])
    save(complete=not queue)
    print(json.dumps({'pages': len(pages), 'failures': len(failures), 'queued': len(queue)}, ensure_ascii=False), flush=True)
    if queue:
        raise SystemExit('Collection limit reached; inventory is incomplete.')


if __name__ == '__main__':
    main()
