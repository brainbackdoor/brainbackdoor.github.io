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

if __name__=='__main__': unittest.main()
