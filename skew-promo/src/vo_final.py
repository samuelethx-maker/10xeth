import json,soundfile as sf,numpy as np
from kokoro_onnx import Kokoro
from faster_whisper import WhisperModel
k=Kokoro('/tmp/lbv/tts/kokoro.onnx','/tmp/lbv/tts/voices.bin');m=WhisperModel('small.en',device='cpu',compute_type='int8')
L=["Every month your money sits idle,","is a month you aren't getting paid.","Skew is Switzerland's member lending platform.",
 "Members lend directly to real businesses, and earn interest, paid daily.","No middlemen. No subscriptions.",
 "Join in minutes. Lend to businesses you believe in. Grow with the community.","Registered in Lugano, Switzerland. Built on trust and transparency.","Skew. Money that finally feels fair."]
GAP=[0,.28,.55,.5,.45,.5,.5,.55]
t=0.45;out=[]
for i,l in enumerate(L):
    a,sr=k.create(l,voice='af_heart',speed=0.88,lang='en-us');nz=np.where(np.abs(a)>0.008)[0];a=a[max(0,nz[0]-240):nz[-1]+1800]
    sf.write(f'vo/L{i}.wav',a,sr);idx=np.round(np.arange(0,len(a),sr/16000)).astype(int);idx=idx[idx<len(a)]
    segs,_=m.transcribe(a[idx].astype('float32'),beam_size=5,language='en',word_timestamps=True)
    ws=[(w.word.strip(),round(w.start,2),round(w.end,2)) for s in segs for w in s.words];d=len(a)/sr
    t+=GAP[i];out.append({'text':l,'start':round(t,2),'dur':round(d,2),'words':ws});print(i,round(t,2),round(t+d,2),' | '.join(f'{j}:{w[0]}@{w[1]}' for j,w in enumerate(ws)),flush=True);t+=d
json.dump(out,open('vo/timeline.json','w'));open('vo/tl.js','w').write('window.TL='+json.dumps(out)+';');print('END',round(t,2))
