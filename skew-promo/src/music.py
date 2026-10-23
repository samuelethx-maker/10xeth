# Original score + SFX + voiceover mix for the Skew promo. All sounds synthesised here.
import numpy as np, json, wave, soundfile as sf
SR=48000; DUR=30.0; N=int(SR*DUR); rng=np.random.default_rng(7)
MUS=np.zeros((N,2)); SFX=np.zeros((N,2))
tl=json.load(open('vo/timeline.json')); w=lambda l,i: tl[l]['start']+tl[l]['words'][i][1]
def tt(d): return np.arange(int(d*SR))/SR
def add(buf,sig,t0,g=1.0,pan=0.0):
    i=int(round(t0*SR))
    if i>=N: return
    if i<0: sig=sig[-i:]; i=0
    s=sig[:N-i]*g; buf[i:i+len(s),0]+=s*np.cos((pan+1)*np.pi/4)*1.414; buf[i:i+len(s),1]+=s*np.sin((pan+1)*np.pi/4)*1.414
def mtof(m): return 440*2**((m-69)/12)
def onepole(x,fc):  # lowpass
    a=np.exp(-2*np.pi*fc/SR); y=np.empty_like(x); z=0.0
    for i in range(len(x)): z=(1-a)*x[i]+a*z; y[i]=z
    return y
def lpf(x,fc):  # fast FFT brickwall-ish lowpass with soft knee
    n=len(x); X=np.fft.rfft(x); f=np.fft.rfftfreq(n,1/SR); X*=1/(1+(f/fc)**4); return np.fft.irfft(X,n)
def hpf(x,fc):
    n=len(x); X=np.fft.rfft(x); f=np.fft.rfftfreq(n,1/SR); X*=1/(1+(fc/np.maximum(f,1e-3))**4); return np.fft.irfft(X,n)
def bpf(x,lo,hi): return hpf(lpf(x,hi),lo)
def env(d,a=.005,r=None):
    t=tt(d); e=np.minimum(1,t/a); 
    if r: e*=np.exp(-t/r)
    return e
# ---- instruments
def epiano(m,d=1.6,vel=1.0):  # FM Rhodes-ish
    t=tt(d); f=mtof(m); idx=2.2*np.exp(-t*5)+.25
    s=np.sin(2*np.pi*f*t+idx*np.sin(2*np.pi*f*t))*np.exp(-t*1.6)
    s+=.25*np.sin(2*np.pi*f*14*t)*np.exp(-t*40)  # tine
    return s*np.minimum(1,t/.003)*np.minimum(1,(d-t)/.05)*vel
def pad(ms,d):
    t=tt(d); s=np.zeros(len(t))
    for m in ms:
        for det in(-.09,0,.09):
            f=mtof(m+det); s+=sum(np.sin(2*np.pi*f*h*t+rng.uniform(0,6))/h**1.6 for h in range(1,6))
    e=np.minimum(1,t/.6)*np.minimum(1,(d-t)/.5); return s*e/len(ms)/3
def pluck(m,d=.5):
    t=tt(d); f=mtof(m); s=(np.sin(2*np.pi*f*t)+.3*np.sin(4*np.pi*f*t)+.1*np.sin(6*np.pi*f*t))*np.exp(-t*7)
    return s*np.minimum(1,t/.002)
def bell(m,d=1.4):
    t=tt(d); f=mtof(m); s=np.sin(2*np.pi*f*t+1.6*np.exp(-t*3)*np.sin(2*np.pi*f*3.5*t))*np.exp(-t*3.2)
    return s*np.minimum(1,t/.002)
def kick(g=1):
    t=tt(.42); f=46+70*np.exp(-t*30); s=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*7.5)
    s+=lpf(rng.standard_normal(len(t)),3000)*np.exp(-t*220)*.25; return s*g
def rim():
    t=tt(.12); n=bpf(rng.standard_normal(len(t)),900,5000)*np.exp(-t*60); return (n*.6+np.sin(2*np.pi*1750*t)*np.exp(-t*80)*.4)
def clap():
    t=tt(.3); n=bpf(rng.standard_normal(len(t)),800,6000); e=np.exp(-t*16)
    for o in (.0,.011,.022): e+=np.exp(-np.maximum(0,t-o)*200)*(t>=o)*.6
    return n*e*.5
def shaker():
    t=tt(.07); return hpf(rng.standard_normal(len(t)),6000)*np.exp(-t*60)*np.minimum(1,t/.01)
def sub(m,d):
    t=tt(d); f=mtof(m); return (np.sin(2*np.pi*f*t)+.18*np.sin(4*np.pi*f*t))*np.minimum(1,t/.01)*np.minimum(1,(d-t)/.03)
# ---- sfx
def whoosh(d=.6,lo=300,hi=4000,up=True):
    t=tt(d); n=rng.standard_normal(len(t)); x=t/d; e=np.sin(np.pi*x)**2
    a=bpf(n,lo,lo*3); b=bpf(n,hi/3,hi); mix=x if up else 1-x
    return (a*(1-mix)+b*mix)*e*.9
def pop(m=84):
    t=tt(.12); f=mtof(m)*(1+.6*np.exp(-t*60)); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*35)
def clack():
    t=tt(.05); return (bpf(rng.standard_normal(len(t)),1500,9000)*np.exp(-t*140)+np.sin(2*np.pi*620*t)*np.exp(-t*120)*.5)
def tick():
    t=tt(.02); return np.sin(2*np.pi*3200*t)*np.exp(-t*350)
def boom(d=1.6):
    t=tt(d); f=38+40*np.exp(-t*8); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*2.2)*np.minimum(1,t/.004)
def zip_up(d=.45):
    t=tt(d); f=500+2500*(t/d)**2; return np.sin(2*np.pi*np.cumsum(f)/SR)*np.sin(np.pi*t/d)**2*.4
def thud():
    t=tt(.5); f=60+50*np.exp(-t*25); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*9)+lpf(rng.standard_normal(len(t)),900)*np.exp(-t*30)*.6
def swish():
    t=tt(.22); return bpf(rng.standard_normal(len(t)),2000,9000)*np.sin(np.pi*t/.22)**2*.8
def shimmer(d=2.2):
    t=tt(d); s=np.zeros(len(t))
    for m in (88,91,95,100,103): s+=bell(m,d)*.2
    return s*np.minimum(1,t/.02)

HIT=w(2,0)  # "Skew" -> logo pop + downbeat
BEAT=0.5
def beats(t0,t1): 
    k0=int(np.ceil((t0-HIT)/BEAT-1e-6)); out=[]
    k=k0
    while HIT+k*BEAT<t1-1e-6: out.append((k,HIT+k*BEAT)); k+=1
    return out
# chords per bar (2 beats? no: 4 beats = 2s) from HIT: Fmaj7, Am7, G6, Cmaj9
CH=[[53,57,60,64],[57,60,64,67],[55,59,62,64],[48,55,59,62]]
def chord_at(t): return CH[int(np.floor((t-HIT)/2.0))%4]
# ===== INTRO 0..HIT: low drone + flap clacks + clock ticks
add(MUS,pad([45,52,57,59],HIT+.6),0,.22)
add(MUS,sub(33,HIT+.3)*np.linspace(.3,1,int((HIT+.3)*SR)),0,.18)
FLIPS=[0.42+i*0.3 for i in range(11)]
for ft in FLIPS:
    for j,o in enumerate((0,.03,.06)): add(SFX,clack(),ft+o,.32,pan=.25+j*.1)
for k in range(int(HIT/0.5)+1):
    if k*0.5<HIT-.2: add(SFX,tick(),k*0.5+.25,.12,pan=-.3)
add(SFX,whoosh(.9,200,6000,True),HIT-.85,.4)                # rising into the logo
t=tt(.7); add(SFX,np.sin(2*np.pi*np.cumsum(300+900*(t/.7)**2)/SR)*np.sin(np.pi*t/.7)*.25,4.02,.5)  # chart morph glide
add(SFX,np.exp(-tt(.03)*60)*0,w(1,6))
t=tt(.35); add(SFX,np.sin(2*np.pi*180*t)*np.exp(-t*12)*.6,w(1,6)+.02,.25)   # "paid" dull thunk on 0.00
# ===== LOGO HIT
add(SFX,boom(),HIT,.55); add(SFX,shimmer(),HIT,.35); add(SFX,whoosh(.6,400,8000,False),HIT,.35)
for i in range(4): add(SFX,tick(),5.55+i*.12,.18,pan=.3)     # wordmark letters
add(SFX,whoosh(.5,300,3000),5.3,.25,pan=.4)                 # card in
add(SFX,pop(86),6.0,.2,pan=.4)
for i in range(6): add(SFX,pop(79+i*2),6.35+i*.07,.14,pan=-.4+i*.1)
# ===== GROOVE A  HIT..12.85
END_A=12.85
for k,tb in beats(HIT,END_A):
    add(MUS,kick(),tb,.62)
    if k%2: add(MUS,clap(),tb,.22)
    add(MUS,rim(),tb+.25,.08,pan=.3)
    for s in range(4): add(MUS,shaker(),tb+s*.125+(.02 if s%2 else 0),.08 if s%2 else .05,pan=-.2)
for bar_t in np.arange(HIT,END_A,2.0):
    c=chord_at(bar_t+.01)
    for o in (0,.75,1.25):  # syncopated e-piano comp
        if bar_t+o<END_A:
            for m in c: add(MUS,epiano(m+12,1.4,.9 if o==0 else .6),bar_t+o,.07,pan=rng.uniform(-.3,.3))
    add(MUS,sub(c[0]-12,min(1.9,END_A-bar_t)),bar_t,.26)
    add(MUS,pad([m+12 for m in c],min(2.3,END_A-bar_t+.2)),bar_t,.12)
for k,tb in beats(HIT+4.0,END_A):
    c=chord_at(tb+.01)
    for s in range(2): add(MUS,pluck(c[(k*2+s)%4]+24),tb+s*.25,.08,pan=.4 if s else -.4)
# S2->S3 transition, connector, notifications
add(SFX,whoosh(.6,300,5000),7.72-.3,.35,pan=-.4)
add(SFX,zip_up(.5),w(3,1),.3,pan=0)
split=w(3,6)-.02; add(SFX,whoosh(.6,300,6000),split-.05,.38,pan=-.5)
NT=[w(3,7)+.1,w(3,9),w(3,10)+.15,w(3,10)+.65]
for i,t0 in enumerate(NT): add(SFX,bell(88+[0,2,4,7][i],1.0)*.6+np.pad(bell(95+[0,2,4,7][i],.8),(0,9600))*.25,t0,.22,pan=.5)
add(SFX,pop(84),w(3,10)+.2,.22)
# ===== BREAKDOWN 12.85..15.55
add(SFX,whoosh(.6,300,6000),12.85-.3,.35,pan=.5)
add(MUS,pad([53,60,64,69],2.9),12.85,.16)
for t0 in (w(4,0),w(4,2)):
    add(MUS,kick(),t0,.55); add(MUS,sub(41,.9),t0,.3)
    for m in chord_at(t0)[:3]: add(MUS,epiano(m+12,1.2),t0,.08)
mid=w(4,1); add(SFX,swish(),mid-.05,.5); add(SFX,thud(),mid+.5,.35); add(SFX,zip_up(.5),mid+.35,.28)
add(SFX,swish(),w(4,3)+.2,.4)
for i in range(3): add(SFX,pop(80+i*4),12.9+i*.08,.16,pan=-.5+i*.5)
# ===== GROOVE B 15.55..21.0
END_B=21.0
add(SFX,whoosh(.6,300,6000),15.55-.3,.35)
for k,tb in beats(15.55,END_B):
    add(MUS,kick(),tb,.62)
    if k%2: add(MUS,clap(),tb,.24)
    for s in range(4): add(MUS,shaker(),tb+s*.125+(.02 if s%2 else 0),.1 if s%2 else .06,pan=.2)
    c=chord_at(tb+.01)
    for s in range(4): add(MUS,pluck(c[(k*4+s)%4]+24+(12 if s==3 else 0),.4),tb+s*.125,.06,pan=-.35 if s%2 else .35)
    add(MUS,sub(c[0]-12 if k%2==0 else c[0],.45),tb,.24)
for bar_t in np.arange(HIT+np.ceil((15.55-HIT)/2)*2-2,END_B,2.0):
    if bar_t+2<15.55: continue
    c=chord_at(bar_t+.01)
    for o in (0,.75,1.25):
        tt0=bar_t+o
        if 15.55<=tt0<END_B:
            for m in c: add(MUS,epiano(m+12,1.4,.8),tt0,.07,pan=rng.uniform(-.3,.3))
    add(MUS,pad([m+12 for m in c],2.3),max(bar_t,15.55),.12)
ON=[w(5,0)-.05,w(5,3)-.05,w(5,9)-.05]
for i,t0 in enumerate(ON): add(SFX,whoosh(.55,250,4000),t0-.2,.32,pan=-.3+i*.3); add(SFX,pop(76+i*3),t0+.2,.12)
add(SFX,pop(88),ON[2]+.4,.18,pan=.5)
# ===== CINEMATIC 21..26.3
add(SFX,whoosh(.8,150,5000),21.0-.4,.42); add(SFX,boom(2.2),21.0,.45)
add(MUS,pad([45,52,57,60,64],5.6),21.0,.2)
for k,tb in beats(21.0,26.3):
    if k%2==0: add(MUS,kick(),tb,.5)
    add(MUS,shaker(),tb+.25,.07)
    if k%4==2: add(MUS,clap(),tb,.18)
for bar_t in np.arange(21.0,26.3,2.0):
    c=chord_at(bar_t+.01); add(MUS,sub(c[0]-12,1.95),bar_t,.24)
    for m in c: add(MUS,epiano(m+12,1.9,.7),bar_t,.07)
add(SFX,pop(84),21.3,.16,pan=.6)
sw=w(6,4)-.15; add(SFX,whoosh(.5,300,5000),sw-.15,.3)
add(SFX,pop(86),w(6,6),.18); add(SFX,pop(89),w(6,8),.18)
# ===== END 26.3..30
add(SFX,whoosh(.6,300,6000),26.3-.3,.35)
add(SFX,boom(2.5),26.45,.5); add(SFX,shimmer(3),26.45,.38)
for i in range(4): add(SFX,tick(),26.6+i*.12,.16,pan=.3)
endc=[41,53,57,60,64,67,72]
add(MUS,pad([m+12 for m in endc[1:]],3.6),26.4,.2)
for m in endc: add(MUS,epiano(m+12,3.5,.9),26.45,.06)
add(MUS,sub(29,3.2),26.45,.3)
add(SFX,pop(84),28.25,.2); add(SFX,pop(88),28.4,.2)

# ---- master music bus: gentle glue + reverb
def conv(x,h):
    n=1<<int(np.ceil(np.log2(len(x)+len(h)))); return np.fft.irfft(np.fft.rfft(x,n)*np.fft.rfft(h,n),n)[:len(x)]
ir=np.exp(-tt(1.8)*3.0)
for c in range(2):
    h=rng.standard_normal(len(ir))*ir; h=lpf(h,7000); h/=np.sqrt((h**2).sum())
    MUS[:,c]+=.18*conv(MUS[:,c],h); SFX[:,c]+=.12*conv(SFX[:,c],h)
# ---- voiceover: HPF, presence lift, light compression
VO=np.zeros(N)
for i,l in enumerate(tl):
    a,sr=sf.read(f'vo/L{i}.wav'); a=np.interp(np.arange(int(len(a)*SR/sr))*(sr/SR),np.arange(len(a)),a)
    a/=np.abs(a).max(); s=int(round(l['start']*SR)); VO[s:s+len(a)]+=a[:N-s]
VO=hpf(VO,85)
X=np.fft.rfft(VO); f=np.fft.rfftfreq(N,1/SR); X*=1+0.35*np.exp(-((f-3200)/1400)**2)-0.15*np.exp(-((f-250)/120)**2); VO=np.fft.irfft(X,N)
e=np.sqrt(np.convolve(VO**2,np.ones(960)/960,'same')); thr=.16; g=np.where(e>thr,(thr/np.maximum(e,1e-9))**.45,1.0)
g=np.convolve(g,np.ones(240)/240,'same'); VO*=g; VO/=np.abs(VO).max()
# ---- sidechain duck under voice
act=(np.convolve(np.abs(VO),np.ones(2400)/2400,'same')>.015).astype(float)
act=np.convolve(act,np.ones(7200)/7200,'same'); duck=1-.5*np.clip(act,0,1)
MUS/=np.abs(MUS).max(); SFX/=np.abs(SFX).max()
bed=(MUS*.55+SFX*.5)*duck[:,None]
tf=np.arange(N)/SR; fade=np.clip((DUR-tf)/1.2,0,1)**1.3*np.clip(tf/.01,0,1)
mix=(bed*.5+VO[:,None]*.78)*fade[:,None]
mix=np.tanh(mix*1.1)/np.tanh(1.1); mix/=np.abs(mix).max(); mix*=.9
def wr(n,x):
    with wave.open(n,'wb') as o: o.setnchannels(2); o.setsampwidth(3); o.setframerate(SR); x=np.clip(x,-1,1); b=(x*8388607).astype('<i4'); o.writeframes(np.stack([b&0xff,(b>>8)&0xff,(b>>16)&0xff],-1).astype(np.uint8).tobytes())
wr('mix.wav',mix); wr('bed.wav',bed*.5*fade[:,None]/np.abs(mix).max()); wr('vo_only.wav',np.stack([VO,VO],1)*.78*fade[:,None])
print('ok')
