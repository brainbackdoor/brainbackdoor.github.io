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
        self.assertIn('<details',out); self.assertIn('/one.png',out)
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

if __name__=='__main__': unittest.main()
