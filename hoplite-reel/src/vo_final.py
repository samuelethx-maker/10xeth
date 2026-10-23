import json,soundfile as sf,numpy as np
from kokoro_onnx import Kokoro
from faster_whisper import WhisperModel
k=Kokoro('/tmp/lbv/tts/kokoro.onnx','/tmp/lbv/tts/voices.bin');m=WhisperModel('small.en',device='cpu',compute_type='int8')
L=["Local agents die when your laptop sleeps.","Hoplite agents keep shipping, from the cloud.","Connect your repository. Bring Claude Code, or Codex.",
"Every agent gets its own isolated sandbox. Run hundreds, in parallel.","Each change is tested, verified, and recorded, before you merge.","Build with swarms of cloud agents.","Hoplite. Close the lid."]
START=[0.75,4.05,7.55,11.55,17.0,21.75,25.15]
out=[]
for i,l in enumerate(L):
    a,sr=k.create(l,voice='am_michael',speed=0.87,lang='en-us');nz=np.where(np.abs(a)>0.008)[0];a=a[max(0,nz[0]-240):nz[-1]+1800]
    sf.write(f'vo/L{i}.wav',a,sr);idx=np.round(np.arange(0,len(a),sr/16000)).astype(int);idx=idx[idx<len(a)]
    segs,_=m.transcribe(a[idx].astype('float32'),beam_size=5,language='en',word_timestamps=True)
    ws=[(w.word.strip(),round(w.start,2),round(w.end,2)) for s in segs for w in s.words];d=len(a)/sr
    out.append({'text':l,'start':START[i],'dur':round(d,2),'words':ws})
    nxt=START[i+1] if i+1<len(START) else 30
    print(i,START[i],round(START[i]+d,2),'gap->',round(nxt-START[i]-d,2),' | '.join(f'{j}:{w[0]}@{w[1]}' for j,w in enumerate(ws)),flush=True)
json.dump(out,open('vo/timeline.json','w'));open('vo/tl.js','w').write('window.TL='+json.dumps(out)+';')
