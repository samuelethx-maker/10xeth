import json, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
from faster_whisper import WhisperModel
k=Kokoro('tts/kokoro.onnx','tts/voices.bin'); m=WhisperModel('small.en',device='cpu',compute_type='int8')
LINES=[
 "Longbow is the credit layer for Robinhood Chain.",
 "Tokenized stocks, crypto, and real-world assets should not sit idle.",
 "Borrow U. S. D. G. against them. No credit check. No desk.",
 "Or lend U. S. D. G., and earn interest from borrowers.",
 "Every market is isolated, with its own oracle, and risk limits.",
 "Zero-fee flash loans, and tools for AI agents.",
 "Longbow. Credit for every asset the chain holds.",
]
out=[]
for i,l in enumerate(LINES):
    a,sr=k.create(l,voice='af_heart',speed=0.86,lang='en-us')
    nz=np.where(np.abs(a)>0.01)[0]; a=a[max(0,nz[0]-240):nz[-1]+2400]
    sf.write(f'vo/L{i}.wav',a,sr)
    idx=np.round(np.arange(0,len(a),sr/16000)).astype(int); idx=idx[idx<len(a)]
    segs,_=m.transcribe(a[idx].astype('float32'),beam_size=5,language='en',word_timestamps=True)
    ws=[(w.word.strip(),round(w.start,2),round(w.end,2)) for s in segs for w in s.words]
    out.append({'text':l,'dur':round(len(a)/sr,2),'words':ws})
    print(i,round(len(a)/sr,2),' '.join(w[0] for w in ws))
json.dump(out,open('vo/lines.json','w'),indent=0)
print('total',sum(o['dur'] for o in out))
