#!/usr/bin/env python3
"""Compile the researched collection; keep the scaffold collection as an archive."""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import exam_letters, exam_essays, exam_speaking_one, exam_speaking_two, exam_speaking_three
from exam_common import SOURCES, words

OUT = Path(__file__).resolve().parents[2] / 'frontend/public/model-library-data/exam'
VERSION = '2026-11-05-researched-v1'
GROUPS = [
    dict(id='writing-task1',skill='writing',label='Writing Task 1 · Thư / email',minimum=120,description='10 đề riêng: trả lời thông tin, xin việc, phàn nàn, yêu cầu thông tin, xin lỗi, từ chối, cảm ơn và lời mời. Hai giọng trang trọng / thân mật.'),
    dict(id='writing-task2',skill='writing',label='Writing Task 2 · Bài luận',minimum=250,description='10 bài luận có lập luận riêng. Đọc động từ yêu cầu của từng đề trước khi chọn cách triển khai.'),
    dict(id='speaking-part1',skill='speaking',label='Speaking Part 1 · Giao tiếp xã hội',description='10 bộ hỏi đáp; mỗi bộ có hai chủ đề quen thuộc và sáu câu hỏi. Thay thông tin cá nhân bằng trải nghiệm thật của bạn.'),
    dict(id='speaking-part2',skill='speaking',label='Speaking Part 2 · Thảo luận giải pháp',description='10 tình huống, mỗi tình huống có ba phương án riêng. Chọn một, nêu lý do và so sánh với hai phương án còn lại.'),
    dict(id='speaking-part3',skill='speaking',label='Speaking Part 3 · Phát triển chủ đề',description='10 chủ đề với ba nhánh gợi ý cụ thể, bài nói triển khai từng nhánh và ba câu hỏi mở rộng.'),
]

def answer(s): return '\n\n'.join([p['text'] for p in s['paragraphs']] + [q['answer'] for sec in s['sections'] for q in sec['questions']])

def validate(samples):
    assert len(samples)==50
    assert len({s['id'] for s in samples})==50
    assert len({answer(s) for s in samples})==50
    assert Counter(s['group'] for s in samples)=={g['id']:10 for g in GROUPS}
    assert Counter(s['provenance']['kind'] for s in samples)=={'published-sample':10,'original-practice':40}
    for s in samples:
        body=answer(s)
        assert not re.search(r'\[[^\]]+\]|undefined|TODO|\{[^}]+\}',body),s['id']
        assert s['wordCount']==words(body)
        assert s['wordCount']>= {'writing-task1':120,'writing-task2':250}.get(s['group'],120),s['id']
        assert len(s['phrases'])==3 and s['coverage'] and s['framePhrases']
        assert all(check['evidence'] in body for check in s['coverage']),s['id']
        assert s['provenance']['url'] in {source['url'] for source in SOURCES.values()}
        units=s['paragraphs']+[q for sec in s['sections'] for q in sec['questions']]
        fixed=0
        for unit in units:
            assert ''.join(part['text'] for part in unit['parts']) == unit.get('text',unit.get('answer'))
            fixed+=sum(words(part['text']) for part in unit['parts'] if part['kind']=='frame')
        assert 0 < fixed < s['wordCount']*0.25, (s['id'],'too much memorised language')
        if s['group']=='speaking-part1':
            assert len(s['sections'])==2 and all(len(sec['questions'])==3 for sec in s['sections'])
        elif s['group']=='speaking-part2':
            assert len(s['options'])==len(set(s['options']))==3 and s['selectedOption'] in [0,1,2]
        elif s['group']=='speaking-part3':
            assert len(s['suggestedIdeas'])==3 and len(s['sections'][0]['questions'])==3
        if s['provenance']['kind']=='published-sample':
            expected=18 if s['group'].startswith('writing') else 17
            if 'ufl.udn' in s['provenance']['url']: expected=15 if s['group'].startswith('writing') else 16
            assert s['provenance']['page']==expected
    for g in GROUPS:
        members=[s for s in samples if s['group']==g['id']]
        assert sum(s['provenance']['kind']=='published-sample' for s in members)==2
        print(g['id'],len(members),'samples;',min(s['wordCount'] for s in members),'–',max(s['wordCount'] for s in members),'words')

def build():
    samples=[s for module in [exam_letters,exam_essays,exam_speaking_one,exam_speaking_two,exam_speaking_three] for s in module.samples()]
    outputs, summaries, types={},[],{}
    for group in GROUPS:
        members=[s for s in samples if s['group']==group['id']]
        for i,s in enumerate(members,1):
            s['number']=i
            types[(s['group'],s['type'])]={'id':s['type'],'group':s['group'],'label':s.pop('typeLabel'),**({'register':s['register']} if s['register'] else {})}
            summaries.append({key:s[key] for key in ['id','group','type','topic','number','title','focus','wordCount','register']} | {'bucket':f"exam/{group['id']}.json",'sourceKind':s['provenance']['kind']})
        outputs[group['id']+'.json']={'version':VERSION,'samples':members}
    validate(samples)
    outputs['index.json']={'version':VERSION,'total':50,'groups':[g|{'count':10} for g in GROUPS], 'topics':[{'id':'situations','label':'Các đề và tình huống riêng'}], 'types':list(types.values()), 'samples':summaries,'sourceUrl':SOURCES['practice']['url']}
    return outputs

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    outputs=build()
    for name,data in outputs.items():
        target=OUT/name
        rendered=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
        if args.check: assert target.exists() and target.read_text()==rendered, f'Out of date: {target}'
        else:
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_text(rendered)
    assert {p.name for p in OUT.glob('*.json')}==set(outputs)
    print('Verified' if args.check else 'Built','50 individually authored samples: 10 source-adapted, 40 original practice.')
if __name__=='__main__': main()
