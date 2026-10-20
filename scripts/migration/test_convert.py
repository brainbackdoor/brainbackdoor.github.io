import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('convert', Path(__file__).with_name('convert.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

ROOT='00000000-0000-0000-0000-000000000001'
def converter(blocks):
    blocks={key:{'value':dict(value,id=key)} for key,value in blocks.items()}
    blocks[ROOT]={'value':{'id':ROOT,'type':'page','properties':{'title':[['원문 제목']]},'content':['one','two']}}
    entry={'sourceId':ROOT,'title':'원문 제목','slug':'sample','pubDate':'2020-01-01','category':'infra','targetPath':'/posts/sample'}
    return module.Converter({'pageID':ROOT,'recordMap':{'block':blocks},'queryCollectionResult':{'unused':None}},entry,[entry],download=False)

class ConversionTests(unittest.TestCase):
    def test_no_download_reuses_actual_local_extension_dimensions_and_hash(self):
        import hashlib
        import struct
        import tempfile
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            c=converter({'one':{'type':'text'},'two':{'type':'text'}});c.output_root=Path(tmp)
            folder=Path(tmp)/'public/content'/ROOT;folder.mkdir(parents=True)
            data=b'\x89PNG\r\n\x1a\n'+b'\0'*8+struct.pack('>II',32,24)
            path=folder/'one.png';path.write_bytes(data)
            with patch.object(module,'urlopen',side_effect=AssertionError('network is forbidden')) as network:
                local=c.asset('https://example.com/cache-without-extension','one')
                self.assertEqual(local,'/content/'+ROOT+'/one.png')
                self.assertEqual(c.report['assets'][0]['status'],'downloaded')
                self.assertEqual(c.report['assets'][0]['sha256'],hashlib.sha256(data).hexdigest())
                self.assertEqual((c.report['assets'][0]['width'],c.report['assets'][0]['height']),(32,24))
                self.assertEqual(path.read_bytes(),data);network.assert_not_called()

    def test_no_download_with_no_local_asset_never_fetches_or_creates_a_folder(self):
        import tempfile
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            c=converter({'one':{'type':'text'},'two':{'type':'text'}});c.output_root=Path(tmp)
            with patch.object(module,'urlopen',side_effect=AssertionError('network is forbidden')) as network:
                self.assertEqual(c.asset('https://example.com/image.png','one'),'https://example.com/image.png')
                self.assertEqual(c.report['assets'][0]['localPath'],'https://example.com/image.png')
                self.assertEqual(c.report['assets'][0]['status'],'not-downloaded')
                self.assertNotIn('sha256',c.report['assets'][0]);network.assert_not_called()
            self.assertFalse((Path(tmp)/'public').exists())

    def test_no_download_missing_bookmark_cover_is_omitted_without_a_fake_local_image(self):
        import tempfile
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            c=converter({'one':{'type':'bookmark','properties':{'title':[['참고 자료']],
                'link':[['https://example.com/article']]},'format':{'bookmark_cover':'https://example.com/missing-cover.png'}},
                'two':{'type':'text'}});c.output_root=Path(tmp)
            with patch.object(module,'urlopen',side_effect=AssertionError('network is forbidden')) as network:
                out=c.convert();network.assert_not_called()
            self.assertNotIn('<img',out);self.assertNotIn('/content/',out)
            self.assertIn('href="https://example.com/article"',out)
            self.assertEqual(c.report['assets'][0]['localPath'],'https://example.com/missing-cover.png')
            self.assertIn('preview omitted',c.report['assets'][0]['renderPolicy'])

    def test_mdx_syntax_is_escaped_without_losing_text(self):
        c=converter({'one':{'type':'text','properties':{'title':[['<Tag> {value} *literal* `code` & [x]',[['b']]]]}},'two':{'type':'text'}})
        out=c.convert()
        self.assertIn('&lt;Tag&gt; &#123;value&#125; &#42;literal&#42; &#96;code&#96; &amp; &#91;x&#93;',out)
        self.assertIn('<strong>',out)

    def test_nested_lists_toggles_and_fences_are_preserved(self):
        c=converter({'one':{'type':'bulleted_list','properties':{'title':[['부모']]},'content':['child']},'child':{'type':'numbered_list','properties':{'title':[['자식']]}},'two':{'type':'toggle','properties':{'title':[['상세']]},'content':['code']},'code':{'type':'code','properties':{'title':[['```\n{x: 1}\n```']],'language':[['JavaScript']]}}})
        out=c.convert()
        self.assertIn('<ul>\n\n<li',out); self.assertIn('<ol>\n\n<li',out)
        self.assertIn('className="notion-toggle" open',out)
        self.assertIn('````javascript\n```\n{x: 1}\n```\n````',out)
        self.assertEqual(len(c.report['blocks']),4)

    def test_caption_table_and_source_anchor_link(self):
        c=converter({'one':{'type':'image','properties':{'source':[['https://example.com/image.png']],'caption':[['<그림 1> 설명']]}},'two':{'type':'table','format':{'table_block_column_order':['a','b'],'table_block_column_header':True},'content':['row']},'row':{'type':'table_row','properties':{'a':[['이름']],'b':[['값']]}}})
        out=c.convert(); self.assertIn('<figcaption>&lt;그림 1&gt; 설명</figcaption>',out)
        self.assertIn('<th scope="col">이름</th>',out)
        self.assertEqual(c.target(f'https://www.brainbackdoor.com/{ROOT}#'+ROOT.replace('-','')),f'/posts/sample#{ROOT}')

    def test_collection_items_keep_visible_properties_and_body(self):
        c=converter({'one':{'type':'collection_view','collection_id':'collection','view_ids':['view']},'two':{'type':'text'},'row':{'type':'page','properties':{'title':[['기간']],'task':[['할 일']]},'content':['detail']},'detail':{'type':'text','properties':{'title':[['원본 추가 내용']]}}})
        c.collections['collection']={'name':[['일정']],'schema':{'title':{'name':'기간'},'task':{'name':'해야할 일'}}}
        c.views['view']={'type':'table','format':{'table_properties':[{'property':'title','visible':True},{'property':'task','visible':True}]}}
        c.props['queryCollectionResult']={'view':{'result':{'blockIds':['row']}}}
        out=c.convert()
        self.assertIn('<tr id="row">',out); self.assertIn('해야할 일',out); self.assertIn('원본 추가 내용',out)
        self.assertEqual(c.target('#'+ROOT.replace('-','')),'#'+ROOT)

    def test_only_identified_config_is_excluded(self):
        c=converter({'one':{'type':'code','properties':{'title':[['kakaoChannel: false']],'language':[['YAML']]}},'two':{'type':'code','properties':{'title':[['app: example']],'language':[['YAML']]}}})
        out=c.convert(); self.assertNotIn('kakaoChannel',out); self.assertIn('app: example',out)
        self.assertEqual(c.report['excluded'][0]['sourceBlockId'],'one')

    def test_initial_oopy_config_with_page_metadata_is_excluded(self):
        raw = 'disqus: brainbackdoor | false\nkakaoChannel: false\nfloatFirstTOC: right\ntitle: "글 제목"\ndescription: "설명: 본문 아님"\nignoreMainOgImage: true\nogImage: "https://example.com/image.png"'
        c=converter({'one':{'type':'code','properties':{'title':[[raw]],'language':[['YAML']]}},'two':{'type':'text','properties':{'title':[['실제 글 본문']]}}})
        out=c.convert()
        self.assertNotIn('```yaml',out); self.assertNotIn('ogImage',out)
        self.assertIn('실제 글 본문',out)
        self.assertEqual(c.report['blocks'][0]['status'],'excluded-oopy-configuration')

    def test_article_yaml_examples_are_retained(self):
        for raw in ['title: example\ndescription: documentation', 'services:\n  app:\n    image: mysql', 'kakaoChannel: false\napplication: example']:
            with self.subTest(raw=raw):
                c=converter({'one':{'type':'code','properties':{'title':[[raw]],'language':[['YAML']]}},'two':{'type':'code','properties':{'title':[['kakaoChannel: false']],'language':[['YAML']]}}})
                out=c.convert()
                self.assertIn(raw,out)
                self.assertIn('kakaoChannel: false',out)
                self.assertEqual(c.report['excluded'],[])

    def test_legacy_navigation_is_removed_with_complete_source_trace(self):
        blocks={'one':{'type':'column_list','content':['left','middle','right']},
            'left':{'type':'column','content':['previous']},'middle':{'type':'column','content':['source']},
            'right':{'type':'column','content':['following','blank']},
            'previous':{'type':'text','properties':{'title':[['⬅️ 이전 글 : 없음']]}},
            'source':{'type':'text','properties':{'title':[['‣ ', [['p', ROOT]]]]}},
            'following':{'type':'text','properties':{'title':[['➡️ 다음 글 : TCP 성능']]}},
            'blank':{'type':'text'},'two':{'type':'text','properties':{'title':[['본문과 일반 링크는 보존']]}}}
        for source in [blocks['source'], {'type':'alias','format':{'alias_pointer':{'id':ROOT}}}]:
            with self.subTest(source=source['type']):
                c=converter(dict(blocks,source=source)); out=c.convert()
                self.assertNotIn('이전 글',out); self.assertNotIn('다음 글',out)
                self.assertNotIn('notion-columns',out); self.assertIn('본문과 일반 링크는 보존',out)
                self.assertEqual({b['sourceBlockId'] for b in c.report['blocks']},set(blocks))
                self.assertEqual(sum(b['status']=='excluded-legacy-navigation' for b in c.report['blocks']),8)

    def test_substantive_column_content_is_not_a_navigation_toolbar(self):
        blocks={'one':{'type':'column_list','content':['left','middle','right']},
            'left':{'type':'column','content':['previous']},'middle':{'type':'column','content':['source']},
            'right':{'type':'column','content':['following']},
            'previous':{'type':'text','properties':{'title':[['⬅️ 이전 글 : 비교 자료']]}},
            'following':{'type':'text','properties':{'title':[['➡️ 다음 글 : 비교 자료']]}},
            'source':{'type':'text','properties':{'title':[['본문 설명']] }},'two':{'type':'text'},
            'reference':{'type':'text','properties':{'title':[['본문 설명']]}}}
        for source in [blocks['source'], {'type':'alias','format':{'alias_pointer':{'id':'reference'}}}]:
            with self.subTest(source=source['type']):
                c=converter(dict(blocks,source=source)); out=c.convert()
                self.assertIn('본문 설명',out); self.assertIn('notion-columns',out)
                self.assertEqual(c.report['excluded'],[])

    def test_verified_empty_collection_does_not_expose_stale_rows(self):
        c=converter({'one':{'type':'collection_view','collection_id':'collection','view_ids':['view']},'two':{'type':'text'},'private':{'type':'page','parent_table':'collection','parent_id':'collection','properties':{'title':[['비공개 카드']]}}})
        c.collections['collection']={'schema':{'title':{'name':'이름'}}}
        c.views['view']={'type':'board','page_sort':['private']}
        c.entry['collectionRows']=[{'viewId':'view','complete':True,'sourceIds':[],'evidence':'Public board has no cards.'}]
        out=c.convert()
        self.assertNotIn('비공개 카드',out)
        self.assertEqual(c.report['blocks'][0]['status'],'verified-empty-source-collection')
        self.assertEqual(c.report['warnings'],[])

    def test_board_preserves_visible_group_order(self):
        c=converter({'one':{'type':'collection_view','collection_id':'collection','view_ids':['view']},'two':{'type':'text'},'first':{'type':'page','properties':{'title':[['첫 카드']]}},'last':{'type':'page','properties':{'title':[['마지막 카드']]}},'hidden':{'type':'page','properties':{'title':[['숨은 카드']]}}})
        c.collections['collection']={'schema':{'title':{'name':'이름'}}}; c.views['view']={'type':'board'}
        c.props['queryCollectionResult']={'view':{'result':{'reducerResults':{'board_columns':{'results':[{'value':{'type':'select','value':'그룹 1'},'visible':True},{'value':{'type':'select','value':'숨김'},'visible':False},{'value':{'type':'select','value':'그룹 2'},'visible':True}],'blockResults':{'select:그룹 2':{'blockIds':['last']},'select:숨김':{'blockIds':['hidden']},'select:그룹 1':{'blockIds':['first']}}}}}}}
        out=c.convert()
        self.assertLess(out.index('첫 카드'),out.index('마지막 카드'))
        self.assertIn('그룹 1',out); self.assertIn('그룹 2',out); self.assertNotIn('숨은 카드',out)

    def test_unknown_source_relative_url_remains_on_source_host(self):
        c=converter({'one':{'type':'text'},'two':{'type':'text'}})
        self.assertEqual(c.target('/d79efbba6b6148be9b834124180725f8?pvs=25'),'https://www.brainbackdoor.com/d79efbba6b6148be9b834124180725f8?pvs=25')
        external='https://b2bservice.notion.site/34057310bbaa4386bb0a231b388239f1'
        self.assertEqual(c.target(external),external)

    def test_gfm_punctuation_and_autolink_triggers_are_literal(self):
        raw='2~3년, https://example.com/test_name#section, www.example.com/a_b, a_b@example.com'
        escaped=module.text_escape(raw)
        import html
        self.assertEqual(html.unescape(escaped),raw)
        self.assertNotIn('https:',escaped); self.assertNotIn('www.',escaped); self.assertNotIn('~',escaped)

    def test_project_reference_uses_verified_original_and_row_hash_is_replaced(self):
        c=converter({'one':{'type':'text'},'two':{'type':'text'}})
        c.pages[ROOT]['targetPath']='/posts/parent#row'
        self.assertEqual(c.target(f'/{ROOT}#section'),'/posts/parent#section')
        c.pages[ROOT].update(targetPath=None,contentRole='project-reference',sourceUrl=f'https://www.brainbackdoor.com/{ROOT}')
        self.assertEqual(c.target('/'+ROOT.replace('-','')+'?pvs=25'),f'https://www.brainbackdoor.com/{ROOT}')
        c.pages[ROOT]['referenceUrl']=f'https://brainbackdoor.notion.site/Project-{ROOT.replace("-", "")}'
        self.assertEqual(c.target('/'+ROOT.replace('-','')+'?pvs=25'),c.pages[ROOT]['referenceUrl'])
        self.assertEqual(c.target(f'/{ROOT}#section'),c.pages[ROOT]['referenceUrl']+'#section')
        self.assertEqual(c.report['unresolvedLinks'],[])

    def test_gallery_oopy_link_and_created_date_are_preserved(self):
        c=converter({'one':{'type':'collection_view','collection_id':'collection','view_ids':['view']},'two':{'type':'text'},'row':{'type':'page','properties':{'title':[['영상']],'url':[['https://www.youtube.com/watch?v=uuP_LWnYF9A']]}}})
        c.entry['pubDateEvidence']={'kind':'notion_date_property','propertyName':'생성일'}
        c.collections['collection']={'schema':{'title':{'name':'이름'},'url':{'name':'oopy','type':'url'}}}
        c.views['view']={'type':'gallery','format':{'gallery_properties':[{'property':'title','visible':True},{'property':'url','visible':False}]}}
        c.props['queryCollectionResult']={'view':{'result':{'blockIds':['row']}}}
        out=c.convert()
        self.assertIn('href="https://www.youtube.com/watch?v=uuP_LWnYF9A"',out)
        self.assertIn('dateSource: "created"',out)


verify_spec = importlib.util.spec_from_file_location('verify', Path(__file__).with_name('verify.py'))
verify = importlib.util.module_from_spec(verify_spec)
verify_spec.loader.exec_module(verify)

class FigureTests(unittest.TestCase):
    def spec(self, mode='replace', typ='image'):
        return {'figureId':'N01','sourceId':ROOT,'sourceBlockId':'one','sourceType':typ,'mode':mode,'requiredText':['FIFO','손실 4'],'evidenceBlockIds':['one']}

    def test_reconversion_inserts_one_figure_and_preserves_original_evidence_caption_and_anchor(self):
        c=converter({'one':{'type':'image','properties':{'source':[['https://example.com/image.png']],'caption':[['원본 캡션']]}},'two':{'type':'text','properties':{'title':[['본문 보존']]}}})
        c.figure_specs=[self.spec()]
        out=c.convert()
        self.assertEqual(out.count('<LessonFigure'),1)
        self.assertEqual(out.count('import LessonFigure'),1)
        self.assertEqual(out.count('id="one"'),1)
        self.assertIn('<details',out); self.assertIn('src="https://example.com/image.png"',out)
        self.assertIn('원본 캡션',out); self.assertIn('본문 보존',out)
        self.assertEqual(len(c.report.get('figures',[])),1)

    def test_collapsed_source_labels_stay_out_of_the_search_index(self):
        # 검색 본문은 원문만: 접어 둔 원본의 '원본 도해/원본 자료' 라벨은 색인하지 않고, 원본 캡션은 그대로 색인한다
        c=converter({'one':{'type':'image','properties':{'source':[['https://example.com/image.png']],'caption':[['원본 캡션']]}},'two':{'type':'text','properties':{'title':[['본문']]}}})
        c.figure_specs=[self.spec()]
        out=c.convert()
        self.assertIn('<summary data-pagefind-ignore="">원본 도해</summary>',out)
        self.assertNotIn('<summary>',out)
        self.assertIn('<figcaption>원본 캡션</figcaption>',out)
        c=converter({'one':{'type':'text','properties':{'title':[['본문']]}},'two':{'type':'image','properties':{'source':[['https://example.com/ev.png']]}}})
        c.figure_specs=[{**self.spec('after','text'),'evidenceBlockIds':['two']}]
        out=c.convert()
        self.assertIn('<summary data-pagefind-ignore="">원본 자료</summary>',out)
        self.assertNotIn('<summary>',out)

    def test_repeated_source_block_keeps_distinct_existing_anchors(self):
        c=converter({'one':{'type':'image','properties':{'source':[['https://example.com/image.png']]}},'two':{'type':'text'}})
        c.root['content']=['one','one'];c.figure_specs=[self.spec()]
        out=c.convert();doc=self.document(out)
        self.assertEqual(len(doc.ids),len(set(doc.ids)))
        self.assertIn('one',doc.ids);self.assertIn('one-copy-2',doc.ids)
        self.assertEqual(out.count('<LessonFigure'),2)

    def test_code_can_only_receive_a_supplement_and_is_never_replaced(self):
        blocks={'one':{'type':'code','properties':{'title':[['a  b\n  c']],'language':[['Java']]}},'two':{'type':'text'}}
        c=converter(blocks);c.figure_specs=[self.spec('after','code')]
        out=c.convert();self.assertIn('a  b\n  c',out);self.assertEqual(out.count('<LessonFigure'),1)
        c=converter(blocks);c.figure_specs=[self.spec('replace','code')]
        with self.assertRaises(ValueError):c.convert()

    def document(self, content):
        d=verify.ReadingPage();d.feed('<article class="post-content">'+content+'</article>');return d

    def check(self, content, report=None, blocks=None):
        return verify.figure_issues(report or {'sourceId':ROOT,'figures':[self.spec()]},self.document(content),blocks or {'one':{'type':'image'}},[self.spec()])

    def test_registered_figure_without_actual_static_information_fails(self):
        issues=self.check('<span id="one"></span><figure data-figure-id="N01" data-source-block-id="one">title only</figure>')
        self.assertIn('figure-information-missing',[i['type'] for i in issues])

    def test_source_anchor_missing_fails_even_with_correct_figure(self):
        issues=self.check('<figure data-figure-id="N01" data-source-block-id="one">FIFO 손실 4</figure>')
        self.assertIn('figure-anchor-missing',[i['type'] for i in issues])

    def test_missing_figure_and_source_type_mismatch_are_not_exemptions(self):
        self.assertIn('figure-not-rendered',[i['type'] for i in self.check('<span id="one"></span>')])
        issues=self.check('<span id="one"></span><figure data-figure-id="N01" data-source-block-id="one">FIFO 손실 4</figure>',blocks={'one':{'type':'code'}})
        self.assertIn('figure-source-type-mismatch',[i['type'] for i in issues])

    def test_reconversion_report_cannot_silently_drop_an_approved_figure(self):
        issues=self.check('<span id="one"></span><figure data-figure-id="N01" data-source-block-id="one">FIFO 손실 4</figure>',report={'sourceId':ROOT,'figures':[]})
        self.assertIn('figure-not-traced',[i['type'] for i in issues])

    def test_valid_static_figure_with_anchor_passes(self):
        self.assertEqual(self.check('<span id="one"></span><figure data-figure-id="N01" data-source-block-id="one"><svg><text>FIFO</text></svg><p>손실 4</p></figure>'),[])

class RedactionTests(unittest.TestCase):
    """Private values hidden on request: the registry keeps only a pattern, never the original text or its hash."""
    def spec(self, kind='bookmark'):
        return {'id':'redaction-one','sourceId':ROOT,'sourceType':kind,'sourceBlockIds':['one'],'pattern':r'^\d{8}(?= - Google Drive$)','replacement':'기록 폴더','reason':'개인정보 가림'}

    def bookmark(self, title='20190101 - Google Drive'):
        return {'one':{'type':'bookmark','properties':{'title':[[title]],'link':[['https://drive.google.com/drive/folders/x']]}},'two':{'type':'text','properties':{'title':[['다른 본문']]}}}

    def test_redaction_hides_the_bookmark_date_and_records_only_the_redacted_hash(self):
        import hashlib
        c=converter(self.bookmark());c.redaction_specs=[self.spec()];out=c.convert()
        self.assertIn('기록 폴더 - Google Drive',out);self.assertNotIn('20190101',out);self.assertIn('다른 본문',out)
        record=c.report['blocks'][0]
        self.assertEqual(record['sourceTextSha256'],hashlib.sha256('기록 폴더 - Google Drive'.encode()).hexdigest())
        self.assertEqual(record['redaction'],'redaction-one')
        self.assertNotIn('20190101',str(c.report))
        self.assertEqual(c.report['redactions'],[{'id':'redaction-one','sourceBlockIds':['one']}])

    def test_redaction_rejects_another_block_type_or_a_title_without_the_pattern(self):
        for kind in ['type','missing']:
            c=converter(self.bookmark('사진 - Google Drive' if kind=='missing' else '20190101 - Google Drive'));c.redaction_specs=[self.spec('text' if kind=='type' else 'bookmark')]
            with self.subTest(kind=kind),self.assertRaises(ValueError):c.convert()

    def test_verification_requires_the_redaction_in_its_source_anchor_and_trace(self):
        block={'type':'bookmark','properties':{'title':[['20190101 - Google Drive']]}};report={'sourceId':ROOT,'redactions':[{'id':'redaction-one','sourceBlockIds':['one']}]}
        def check(html,trace=report):
            doc=verify.ReadingPage();doc.feed('<article class="post-content">'+html+'</article>')
            self.assertTrue(callable(getattr(verify,'redaction_issues',None)))
            return verify.redaction_issues(trace,doc,{'one':block},[self.spec()])
        self.assertEqual(check('<figure id="one"><p><a href="x">기록 폴더 - Google Drive</a></p></figure>'),[])
        self.assertIn('redaction-not-applied',[i['type'] for i in check('<figure id="one"><p><a href="x">20190101 - Google Drive</a></p></figure>')])
        self.assertIn('redaction-not-traced',[i['type'] for i in check('<figure id="one"><p><a href="x">기록 폴더 - Google Drive</a></p></figure>',{'sourceId':ROOT,'redactions':[]})])

class RedactionEdgeTests(unittest.TestCase):
    """Failure paths: a redaction never guesses, and verification never writes the hidden text anywhere."""
    def spec(self, **extra):
        return dict({'id':'redaction-one','sourceId':ROOT,'sourceType':'text','sourceBlockIds':['one'],'pattern':r'\d{8}','replacement':'날짜','reason':'개인정보 가림'},**extra)

    def test_rejects_ambiguous_split_or_empty_redactions_with_a_clear_reason(self):
        cases={'twice':[['20190101과 20190202']],'split':[['2019'],['0101',[['b']]]],'none-title':None}
        for kind,title in cases.items():
            blocks={'one':{'type':'text','properties':{'title':title}} if title is not None else {'type':'text'},'two':{'type':'text'}}
            c=converter(blocks);c.redaction_specs=[self.spec()]
            with self.subTest(kind=kind),self.assertRaises(ValueError):c.convert()
        for replacement in ['',None,'   ']:
            c=converter({'one':{'type':'text','properties':{'title':[['앞 20190101 뒤']]}},'two':{'type':'text'}});c.redaction_specs=[self.spec(replacement=replacement)]
            with self.subTest(replacement=replacement),self.assertRaises(ValueError):c.convert()

    def test_replacement_is_literal_text(self):
        c=converter({'one':{'type':'text','properties':{'title':[['앞 20190101 뒤']]}},'two':{'type':'text'}});c.redaction_specs=[self.spec(replacement='날짜\\1')]
        out=c.convert();self.assertTrue('날짜\\1' in out or '날짜&#92;1' in out, out[:200])

    def test_verification_compares_redacted_text_and_never_reports_the_hidden_value(self):
        block={'type':'text','properties':{'title':[['앞 20190101 뒤']]}}
        spec=self.spec()
        hidden=verify.redacted_text(block,[spec])
        self.assertEqual(hidden,'앞 날짜 뒤')
        self.assertEqual(verify.redaction_issues({'sourceId':ROOT,'redactions':[]},verify.ReadingPage(),{'one':{'type':'text','properties':{'title':[['다른 글']]}}},[spec])[0]['type'],'redaction-source-mismatch')

class CorrectionTests(unittest.TestCase):
    def edit(self, old='잘못된 설명', new='수정한 설명'):
        import hashlib
        return {'id':'correction-one','sourceId':ROOT,'sourceBlockId':'one','sourceType':'text','sourceTextSha256':hashlib.sha256(('앞 '+old+' 뒤').encode()).hexdigest(),'oldText':old,'newText':new,'reason':'근거 확인','reference':'https://www.rfc-editor.org/rfc/rfc9293.html'}

    def test_correction_keeps_source_hash_annotations_other_text_and_reconversion(self):
        c=converter({'one':{'type':'text','properties':{'title':[['앞 '],['잘못된 설명',[['b']]],[' 뒤']]}},'two':{'type':'text','properties':{'title':[['다른 본문']]}}})
        c.correction_specs=[self.edit()];out=c.convert()
        self.assertIn('<strong>수정한 설명</strong>',out);self.assertIn('앞 ',out);self.assertIn(' 뒤',out);self.assertIn('다른 본문',out)
        self.assertEqual(c.report['blocks'][0]['sourceTextSha256'],self.edit()['sourceTextSha256'])
        self.assertEqual(c.report['corrections'],[self.edit()])
        self.assertEqual(module.plain(c.blocks['one']['properties']['title']),'앞 잘못된 설명 뒤')

    def test_changed_source_wrong_type_and_empty_replacement_are_rejected(self):
        import copy
        for kind in ['hash','type','empty','missing']:
            c=converter({'one':{'type':'text','properties':{'title':[['앞 잘못된 설명 뒤']]}},'two':{'type':'text'}});edit=copy.deepcopy(self.edit())
            if kind=='hash':edit['sourceTextSha256']='0'*64
            if kind=='type':c.blocks['one']['type']='code'
            if kind=='empty':edit['newText']=''
            if kind=='missing':edit['oldText']='없는 설명'
            c.correction_specs=[edit]
            with self.subTest(kind=kind),self.assertRaises(ValueError):c.convert()

    def test_verification_requires_corrected_text_in_its_source_anchor_and_trace(self):
        edit=self.edit();block={'type':'text','properties':{'title':[['앞 잘못된 설명 뒤']]}};report={'sourceId':ROOT,'corrections':[edit]}
        def check(html,trace=report):
            doc=verify.ReadingPage();doc.feed('<article class="post-content">'+html+'</article>')
            self.assertTrue(callable(getattr(verify,'correction_issues',None)))
            return verify.correction_issues(trace,doc,{'one':block},[edit])
        self.assertEqual(check('<p id="one">앞 수정한 설명 뒤</p>'),[])
        self.assertIn('correction-text-missing',[i['type'] for i in check('<p id="one">앞 잘못된 설명 뒤</p><p>앞 수정한 설명 뒤</p>')])
        self.assertIn('correction-not-traced',[i['type'] for i in check('<p id="one">앞 수정한 설명 뒤</p>',{'sourceId':ROOT,'corrections':[]})])

    def test_verifier_rejects_stale_hash_and_converter_preserves_annotation_boundaries(self):
        bad=dict(self.edit(),sourceTextSha256='0'*64)
        block={'type':'text','properties':{'title':[['앞 잘못된 설명 뒤']]}}
        doc=verify.ReadingPage();doc.feed('<article class="post-content"><p id="one">앞 수정한 설명 뒤</p></article>')
        self.assertIn('correction-source-mismatch',[i['type'] for i in verify.correction_issues({'sourceId':ROOT,'corrections':[bad]},doc,{'one':block},[bad])])
        c=converter({'one':{'type':'text','properties':{'title':[['앞 '],['잘못된 ',[['b']]],['설명 뒤', [['i']]]]}},'two':{'type':'text'}})
        c.correction_specs=[self.edit()]
        with self.assertRaises(ValueError):c.convert()

    def test_list_supplement_is_inside_the_original_list_item(self):
        c=converter({'one':{'type':'bulleted_list','properties':{'title':[['gzip 실습']]}},'two':{'type':'text'}})
        c.figure_specs=[dict(FigureTests().spec('after','bulleted_list'))];out=c.convert()
        self.assertLess(out.index('<LessonFigure'),out.index('</li>'))
        self.assertEqual(out.count('id="one"'),1)

    def test_list_correction_cannot_be_satisfied_by_child_blocks(self):
        edit=dict(self.edit(),sourceType='bulleted_list')
        block={'type':'bulleted_list','properties':{'title':[['앞 잘못된 설명 뒤']]}}
        descendants=[
            '<pre><code>앞 수정한 설명 뒤</code></pre>',
            '<table><tr><td>앞 수정한 설명 뒤</td></tr></table>',
            '<figure><svg><text>앞 수정한 설명 뒤</text></svg></figure>',
            '<ul><li><p>앞 수정한 설명 뒤</p></li></ul>',
            '<blockquote><p>앞 수정한 설명 뒤</p></blockquote>',
            '<div><p>앞 수정한 설명 뒤</p></div>',
            '<p>앞 수정한 설명 뒤</p>',
        ]
        for child in descendants:
            with self.subTest(child=child):
                doc=verify.ReadingPage()
                doc.feed('<article class="post-content"><ul><li id="one"><p></p>'+child+'</li></ul></article>')
                issues=verify.correction_issues({'sourceId':ROOT,'corrections':[edit]},doc,{'one':block},[edit])
                self.assertIn('correction-text-missing',[i['type'] for i in issues])
        doc=verify.ReadingPage()
        doc.feed('<article class="post-content"><ul><li id="one"><p>앞 <strong>수정한 <code>설명</code></strong> 뒤</p>'+descendants[0]+'</li></ul></article>')
        self.assertEqual(verify.correction_issues({'sourceId':ROOT,'corrections':[edit]},doc,{'one':block},[edit]),[])

    def test_text_correction_requires_its_own_inline_prose(self):
        edit=self.edit();block={'type':'text','properties':{'title':[['앞 잘못된 설명 뒤']]}}
        doc=verify.ReadingPage()
        doc.feed('<article class="post-content"><div id="one"><figure><svg><text>앞 수정한 설명 뒤</text></svg></figure></div></article>')
        issues=verify.correction_issues({'sourceId':ROOT,'corrections':[edit]},doc,{'one':block},[edit])
        self.assertIn('correction-text-missing',[i['type'] for i in issues])

    def test_callout_correction_preserves_emphasis_links_and_checks_its_own_first_paragraph(self):
        c=converter({'one':{'type':'callout','format':{'page_icon':'💡'},'properties':{'title':[
            ['앞 '],['잘못된 설명',[['b']]],[' 뒤 '],['GitHub',[['a','https://github.com/example/repo']]]]},'content':['child']},
            'child':{'type':'text','properties':{'title':[['자식 설명']]}},'two':{'type':'text'}})
        edit=dict(self.edit(),sourceType='callout',sourceTextSha256=module.hashlib.sha256('앞 잘못된 설명 뒤 GitHub'.encode()).hexdigest())
        c.correction_specs=[edit];out=c.convert()
        self.assertIn('<strong>수정한 설명</strong>',out)
        self.assertIn('<a href="https://github.com/example/repo">GitHub</a>',out)
        self.assertIn('자식 설명',out)
        doc=verify.ReadingPage();doc.feed('<article class="post-content">'+out+'</article>')
        self.assertEqual(verify.correction_issues(c.report,doc,c.blocks,[edit]),[])
        doc=verify.ReadingPage();doc.feed('<article class="post-content"><blockquote id="one" class="notion-callout"><p>💡 잘못된 설명</p><p id="child">앞 수정한 설명 뒤 GitHub</p></blockquote></article>')
        self.assertIn('correction-text-missing',[x['type'] for x in verify.correction_issues(c.report,doc,c.blocks,[edit])])

class OmissionTests(unittest.TestCase):
    def spec(self, c, block_id='one', **changes):
        return dict({'id':'duplicate-'+block_id, 'sourceId':ROOT, 'sourceBlockId':block_id,
                     'sourceType':c.blocks[block_id]['type'],
                     'sourceBlockSha256':module.source_block_sha256(c.blocks[block_id]),
                     'reason':'도해와 완전히 중복된 설명'}, **changes)

    def source(self, kind='text', **extra):
        return converter({'one':dict({'type':kind,'properties':{'title':[['중복 설명', [['b']]]]}}, **extra),
                          'two':{'type':'text','properties':{'title':[['남기는 본문']]}}})

    def document(self, html):
        doc=verify.ReadingPage();doc.feed('<article class="post-content">'+html+'</article>');return doc

    def test_exact_omission_keeps_empty_hidden_anchor_and_full_trace(self):
        c=self.source();spec=self.spec(c);c.omission_specs=[spec];out=c.convert()
        self.assertNotIn('중복 설명',out);self.assertIn('남기는 본문',out)
        self.assertIn('<span id="one" data-editorial-omission="duplicate-one" hidden></span>',out)
        self.assertEqual(c.report['blocks'][0]['status'],'excluded-editorial-duplicate')
        self.assertEqual(c.report['excluded'][0]['omissionId'],spec['id'])
        self.assertEqual(c.report['omissions'],[spec])
        self.assertEqual(verify.omission_issues(dict(c.report),self.document(out),c.blocks,[spec]),[])
        self.assertIn('description: "남기는 본문"',out)

    def test_omitted_list_items_never_leave_empty_or_invalid_lists(self):
        for kind,tag in [('bulleted_list','ul'),('numbered_list','ol'),('to_do','ul')]:
            with self.subTest(kind=kind):
                c=self.source(kind);c.blocks['two']['type']=kind
                c.blocks['middle']={'id':'middle','type':kind,'properties':{'title':[['남는 항목']]}}
                c.root['content']=['one','middle','two']
                c.omission_specs=[self.spec(c),self.spec(c,'two')];out=c.convert()
                self.assertEqual(out.count('<'+tag),1);self.assertEqual(out.count('</'+tag+'>'),1)
                self.assertLess(out.index('id="one"'),out.index('<'+tag))
                self.assertGreater(out.index('id="two"'),out.index('</'+tag+'>'))
                c=self.source(kind);c.root['content']=['one'];c.omission_specs=[self.spec(c)]
                out=c.convert();self.assertNotIn('<'+tag,out);self.assertIn('id="one"',out)

    def test_complete_block_hash_guards_annotations_metadata_and_type(self):
        for field in ['text','annotation','metadata','type','hash']:
            c=self.source();spec=self.spec(c)
            if field=='text':c.blocks['one']['properties']['title'][0][0]='달라진 설명'
            if field=='annotation':c.blocks['one']['properties']['title'][0][1]=[['i']]
            if field=='metadata':c.blocks['one']['format']={'color':'blue'}
            if field=='type':c.blocks['one']['type']='code'
            if field=='hash':spec['sourceBlockSha256']='0'*64
            c.omission_specs=[spec]
            with self.subTest(field=field),self.assertRaisesRegex(ValueError,'source mismatch'):c.convert()

    def test_children_unsupported_types_and_ambiguous_approvals_fail(self):
        for case in ['children','code','duplicate-id','duplicate-block','empty-reason','unreached']:
            c=self.source('code' if case=='code' else 'text');spec=self.spec(c)
            if case=='children':
                c.blocks['one']['content']=['two'];spec=self.spec(c)
            if case=='duplicate-id':c.omission_specs=[self.spec(c,'two',id=spec['id'])]
            if case=='duplicate-block':c.omission_specs=[dict(spec,id='another-id')]
            if case=='empty-reason':spec['reason']='  '
            if case=='unreached':c.root['content']=['two']
            c.omission_specs.append(spec)
            with self.subTest(case=case),self.assertRaises(ValueError):c.convert()

    def test_figures_evidence_corrections_and_redactions_cannot_be_omitted(self):
        for case in ['figure','evidence','correction','redaction']:
            c=self.source();c.omission_specs=[self.spec(c)]
            if case=='figure':c.figure_specs=[{'sourceBlockId':'one'}]
            if case=='evidence':c.figure_specs=[{'sourceBlockId':'two','evidenceBlockIds':['one']}]
            if case=='correction':c.correction_specs=[{'sourceBlockId':'one'}]
            if case=='redaction':c.redaction_specs=[{'sourceBlockIds':['one']}]
            with self.subTest(case=case),self.assertRaisesRegex(ValueError,'overlaps'):c.convert()

    def test_image_omission_never_downloads_or_registers_an_unused_asset(self):
        c=self.source('image');c.blocks['one']['properties']['source']=[['https://example.com/decoration.png']]
        c.omission_specs=[self.spec(c)]
        def reject_asset(*args,**kwargs):raise AssertionError('omitted image fetched an asset')
        c.asset=reject_asset;out=c.convert()
        self.assertNotIn('<img',out);self.assertEqual(c.report['assets'],[])

    def test_headings_and_only_childless_tables_can_be_omitted(self):
        for kind in ['header','sub_header','sub_sub_header','table']:
            c=self.source(kind);c.omission_specs=[self.spec(c)]
            with self.subTest(kind=kind):self.assertIn('hidden></span>',c.convert())
        c=self.source('table',content=['two']);c.omission_specs=[self.spec(c)]
        with self.assertRaisesRegex(ValueError,'child blocks'):c.convert()

    def test_verifier_detects_missing_changed_or_nonempty_anchors_and_trace(self):
        c=self.source();spec=self.spec(c);c.omission_specs=[spec];out=c.convert()
        valid='<span id="one" data-editorial-omission="duplicate-one" hidden></span>'
        cases=[('', 'omission-anchor-missing'),
               (valid.replace(' hidden',''), 'omission-anchor-not-empty'),
               (valid.replace('duplicate-one','other'), 'omission-anchor-not-empty'),
               (valid.replace('</span>','남은 문구</span>'), 'omission-anchor-not-empty'),
               (valid.replace('</span>','<img src="x" /></span>'), 'omission-anchor-not-empty'),
               (valid.replace('</span>','<script>hidden text</script></span>'), 'omission-anchor-not-empty'),
               (valid.replace('<span','<div').replace('</span>','</div>'), 'omission-anchor-not-empty')]
        for html,expected in cases:
            with self.subTest(html=html):
                issues=verify.omission_issues(c.report,self.document(html),c.blocks,[spec])
                self.assertIn(expected,[item['type'] for item in issues])
        for key in ['blocks','excluded','omissions']:
            trace=dict(c.report,**{key:[]})
            issues=verify.omission_issues(trace,self.document(valid),c.blocks,[spec])
            self.assertIn('omission-not-traced',[item['type'] for item in issues])
        issues=verify.omission_issues(c.report,self.document(valid),c.blocks,[])
        self.assertIn('omission-not-approved',[item['type'] for item in issues])
        c.blocks['one']['properties']['title'][0][0]='원문 변경'
        issues=verify.omission_issues(c.report,self.document(valid),c.blocks,[spec])
        self.assertIn('omission-source-mismatch',[item['type'] for item in issues])

    def test_verifier_checks_every_repeated_anchor_and_protected_source(self):
        c=self.source();spec=self.spec(c);c.root['content']=['one','one'];c.omission_specs=[spec];out=c.convert()
        self.assertEqual(verify.omission_issues(c.report,self.document(out),c.blocks,[spec]),[])
        out=out.replace('id="one-copy-2"','id="one-copy-2" title="x"').replace('hidden></span>','hidden>숨김 실패</span>',1)
        issues=verify.omission_issues(c.report,self.document(out),c.blocks,[spec])
        self.assertIn('omission-anchor-not-empty',[item['type'] for item in issues])
        protected=[{'sourceId':ROOT,'sourceBlockId':'two','evidenceBlockIds':['one']}]
        issues=verify.omission_issues(c.report,self.document(out),c.blocks,[spec],figures=protected)
        self.assertIn('omission-overlaps-preserved-source',[item['type'] for item in issues])

    def test_omitted_heading_keeps_one_empty_fragment_alias_and_its_hidden_uuid(self):
        c=self.source('sub_header');spec=self.spec(c,anchorAliases=['적용된-모습'])
        c.root['content']=['one','one','two'];c.omission_specs=[spec];out=c.convert()
        self.assertIn('<span id="one" data-editorial-omission="duplicate-one" hidden></span>',out)
        alias='<div id="적용된-모습" aria-hidden="true"></div>'
        self.assertEqual(out.count(alias),1)
        self.assertEqual(c.report['blocks'][0]['anchorAliases'],['적용된-모습'])
        self.assertEqual(verify.omission_issues(c.report,self.document(out),c.blocks,[spec]),[])
        for changed in [out.replace(alias,''),out+alias,
                        out.replace(alias,alias.replace('aria-hidden="true"','hidden')),
                        out.replace(alias,alias.replace('</div>','글자</div>')),
                        out.replace(alias,alias.replace('</div>','<span></span></div>'))]:
            issues=verify.omission_issues(c.report,self.document(changed),c.blocks,[spec])
            self.assertTrue(any(item['type'] in {'omission-alias-missing-or-duplicate','omission-alias-not-empty'} for item in issues))

    def test_heading_aliases_reject_other_types_whitespace_duplicates_and_source_ids(self):
        for case in ['type','field','whitespace','duplicate','source-id','blank']:
            c=self.source('text' if case=='type' else 'bookmark' if case=='field' else 'header')
            if case=='field':c.blocks['one']['properties']['description']=[['중복 설명']]
            aliases={'whitespace':['a b'],'duplicate':['same','same'],'source-id':['two'],'blank':['']}.get(case,['적용된-모습'])
            spec=self.spec(c,anchorAliases=aliases,**({'field':'description'} if case=='field' else {}));c.omission_specs=[spec]
            with self.subTest(case=case),self.assertRaisesRegex(ValueError,'anchor aliases'):c.convert()

    def test_description_only_omission_keeps_media_link_title_caption_and_children(self):
        for kind in ['bookmark','video','embed']:
            c=self.source(kind,content=['child'])
            c.blocks['one']['properties'].update(source=[['https://example.com/media']],
                description=[['중복된 세 문제 설명']],caption=[['원본 캡션']])
            c.blocks['child']={'id':'child','type':'text','properties':{'title':[['자식 본문']]}}
            spec=self.spec(c,field='description');c.omission_specs=[spec];out=c.convert()
            with self.subTest(kind=kind):
                self.assertNotIn('중복된 세 문제 설명',out)
                for retained in ['중복 설명','https://example.com/media','원본 캡션','자식 본문']:
                    self.assertIn(retained,out)
                if kind!='bookmark':self.assertIn('<iframe',out)
                self.assertEqual(c.report['blocks'][0]['status'],'converted-with-editorial-omission')
                self.assertEqual(c.report['blocks'][0]['omittedFields'],['description'])
                self.assertEqual(verify.omission_issues(c.report,self.document(out),c.blocks,[spec]),[])
                changed=out.replace('</figure>','<p>중복된 세 문제 설명</p></figure>',1)
                self.assertIn('omission-field-still-rendered',[x['type'] for x in verify.omission_issues(c.report,self.document(changed),c.blocks,[spec])])
                missing=out.replace('중복 설명','')
                self.assertIn('omission-preserved-content-missing',[x['type'] for x in verify.omission_issues(c.report,self.document(missing),c.blocks,[spec])])

    def test_field_omissions_reject_other_fields_types_empty_or_stale_description(self):
        for case in ['field','type','empty','stale']:
            c=self.source('text' if case=='type' else 'bookmark')
            c.blocks['one']['properties']['description']=[['重複説明' if case!='empty' else '']]
            spec=self.spec(c,field='title' if case=='field' else 'description')
            if case=='stale':c.blocks['one']['properties']['description']=[['変更']]
            c.omission_specs=[spec]
            with self.subTest(case=case),self.assertRaisesRegex(ValueError,'source mismatch'):c.convert()

    def test_description_omission_cannot_hide_missing_href_iframe_video_or_cover(self):
        import re
        import tempfile
        for kind in ['bookmark','embed','video']:
            with self.subTest(kind=kind),tempfile.TemporaryDirectory() as tmp:
                c=self.source(kind);c.output_root=Path(tmp)
                url='https://example.com/video.mp4' if kind=='video' else 'https://www.youtube.com/watch?v=abcdefghijk'
                c.blocks['one']['properties'].update(source=[[url]],description=[['중복 설명 전체']])
                c.blocks['one']['format']={'bookmark_cover':'https://example.com/cover.png'}
                folder=Path(tmp)/'public/content'/ROOT;folder.mkdir(parents=True)
                (folder/'one-cover.png').write_bytes(b'cover')
                if kind=='video':(folder/'one.mp4').write_bytes(b'video')
                spec=self.spec(c,field='description');c.omission_specs=[spec];out=c.convert()
                self.assertEqual(verify.omission_issues(c.report,self.document(out),c.blocks,[spec]),[])
                for missing,changed in [
                    ('href',re.sub(r'<a\b[^>]*>.*?</a>','',out,flags=re.S)),
                    ('cover',re.sub(r'<img\b[^>]*>','',out)),
                    ('media',re.sub(r'<(?:iframe|video)\b[^>]*>\s*(?:</(?:iframe|video)>)?','',out)),
                    ('wrong-href',out.replace('href="'+(c.report['assets'][0]['localPath'] if kind=='video' else url)+'"','href="https://example.com/wrong"'))]:
                    if missing=='media' and kind=='video' or missing!='media' or '<iframe' in out:
                        issues=verify.omission_issues(c.report,self.document(changed),c.blocks,[spec])
                        self.assertIn('omission-preserved-content-missing',[item['type'] for item in issues],missing)

    def test_description_omission_accepts_only_the_exact_normal_internal_target(self):
        c=self.source('bookmark');target='00000000-0000-0000-0000-000000000099'
        page={'sourceId':target,'targetPath':'/posts/target','sourceUrl':'https://www.brainbackdoor.com/'+target}
        c.pages[target]=page
        c.blocks['one']['properties'].update(link=[['https://www.brainbackdoor.com/'+target]],description=[['중복 설명 전체']])
        spec=self.spec(c,field='description');c.omission_specs=[spec];out=c.convert()
        self.assertIn('href="/posts/target"',out)
        self.assertEqual(verify.omission_issues(c.report,self.document(out),c.blocks,[spec],pages=[page]),[])
        wrong=out.replace('href="/posts/target"','href="/posts/somewhere-else"')
        self.assertIn('omission-preserved-content-missing',[item['type'] for item in verify.omission_issues(c.report,self.document(wrong),c.blocks,[spec],pages=[page])])


class EvidenceGroupTests(unittest.TestCase):
    def source(self):
        c=converter({'one':{'type':'text','properties':{'title':[['애니메이션 앞 본문']]}},
                     'two':{'type':'text','properties':{'title':[['뒤 본문']]}}})
        ids=['heading-a','image-a','heading-b','image-b']
        for suffix in ['a','b']:
            c.blocks['heading-'+suffix]={'id':'heading-'+suffix,'type':'sub_header','properties':{'title':[['정답 '+suffix]]}}
            c.blocks['image-'+suffix]={'id':'image-'+suffix,'type':'image','properties':{'source':[['https://example.com/'+suffix+'.png']],'caption':[['정답 그림 '+suffix]]}}
        c.root['content']=['one',*ids,'two']
        spec={'figureId':'D09','sourceId':ROOT,'sourceBlockId':'one','sourceType':'text','mode':'after',
              'requiredText':['결과'],'evidenceBlockIds':['image-a','image-b'],
              'evidenceGroup':{'blockIds':ids,'label':'원본 정답'}}
        c.figure_specs=[spec];return c,spec

    def document(self, html):
        doc=verify.ReadingPage();doc.feed('<article class="post-content">'+html+'</article>');return doc

    def static(self, out):
        import re
        return re.sub(r'<LessonFigure[^>]+/>','<figure data-figure-id="D09" data-source-block-id="one">결과</figure>',out)

    def test_one_closed_group_preserves_all_source_headings_images_anchors_and_trace(self):
        c,spec=self.source();out=c.convert()
        self.assertEqual(out.count('<details'),1);self.assertNotIn(' open',out)
        self.assertIn('data-figure-evidence-for="D09"',out)
        self.assertIn('<summary data-pagefind-ignore="">원본 정답</summary>',out)
        for value in ['정답 a','정답 b','정답 그림 a','정답 그림 b',*spec['evidenceGroup']['blockIds']]:
            self.assertIn(value,out)
        self.assertEqual(len(c.report['assets']),2)
        self.assertEqual(c.report['evidenceGroups'],[{'figureId':'D09',**spec['evidenceGroup']}])
        self.assertEqual(verify.figure_issues(c.report,self.document(self.static(out)),c.blocks,[spec]),[])

    def test_group_rejects_changed_order_missing_evidence_overlap_or_children(self):
        for case in ['order','missing','overlap','children','unregistered-image','duplicate']:
            c,spec=self.source()
            if case=='order':c.root['content'][2:4]=list(reversed(c.root['content'][2:4]))
            if case=='missing':spec['evidenceGroup']['blockIds']=spec['evidenceGroup']['blockIds'][:-1]
            if case=='overlap':spec['sourceBlockId']='heading-a'
            if case=='children':c.blocks['heading-a']['content']=['two']
            if case=='unregistered-image':spec['evidenceBlockIds']=['image-a']
            if case=='duplicate':spec['evidenceGroup']['blockIds'].append('image-b')
            with self.subTest(case=case),self.assertRaisesRegex(ValueError,'evidence group'):c.convert()

    def test_group_verifier_detects_reopened_missing_reordered_or_untraced_evidence(self):
        c,spec=self.source();out=self.static(c.convert())
        cases=[(out.replace('<details','<details open',1),'figure-evidence-group-content-mismatch'),
               (out.replace('id="image-b"','id="elsewhere"'),'figure-evidence-group-content-mismatch'),
               (out.replace('원본 정답','틀린 제목'),'figure-evidence-group-content-mismatch'),
               (out.replace('data-figure-evidence-for="D09"',''),'figure-evidence-group-not-rendered')]
        for html,kind in cases:
            with self.subTest(kind=kind):
                self.assertIn(kind,[x['type'] for x in verify.figure_issues(c.report,self.document(html),c.blocks,[spec])])
        report=dict(c.report,evidenceGroups=[])
        self.assertIn('figure-evidence-group-not-traced',[x['type'] for x in verify.figure_issues(report,self.document(out),c.blocks,[spec])])
        c.root['content'].reverse()
        self.assertIn('figure-evidence-group-source-mismatch',[x['type'] for x in verify.figure_issues(c.report,self.document(out),c.blocks,[spec])])

if __name__=='__main__': unittest.main()
