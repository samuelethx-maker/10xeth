# Original score + sound design + voiceover mix for the Hoplite reel. Every sound is synthesised here.
import numpy as np, json, wave, soundfile as sf
SR=48000; DUR=30.0; N=int(SR*DUR); rng=np.random.default_rng(11)
MUS=np.zeros((N,2)); SFX=np.zeros((N,2))
tl=json.load(open('vo/timeline.json')); w=lambda l,i: tl[l]['start']+tl[l]['words'][i][1]
def tt(d): return np.arange(int(d*SR))/SR
def add(buf,sig,t0,g=1.0,pan=0.0):
    i=int(round(t0*SR))
    if i>=N: return
    if i<0: sig=sig[-i:]; i=0
    s=sig[:N-i]*g; buf[i:i+len(s),0]+=s*np.cos((pan+1)*np.pi/4)*1.414; buf[i:i+len(s),1]+=s*np.sin((pan+1)*np.pi/4)*1.414
def mtof(m): return 440*2**((m-69)/12)
def filt(x,lo=None,hi=None):
    n=len(x); X=np.fft.rfft(x); f=np.fft.rfftfreq(n,1/SR)
    if hi: X*=1/(1+(f/hi)**4)
    if lo: X*=1/(1+(lo/np.maximum(f,1e-3))**4)
    return np.fft.irfft(X,n)
def noise(d): return rng.standard_normal(int(d*SR))
def fm(m,d,idx=2.0,dec=1.6,ratio=1.0):
    t=tt(d); f=mtof(m); s=np.sin(2*np.pi*f*t+idx*np.exp(-t*5)*np.sin(2*np.pi*f*ratio*t))*np.exp(-t*dec)
    return s*np.minimum(1,t/.003)*np.minimum(1,(d-t)/.05)
def epiano(m,d=1.6,v=1.0): t=tt(d); return (fm(m,d,2.2,1.6)+.22*np.sin(2*np.pi*mtof(m)*14*t)*np.exp(-t*40))*v
def bell(m,d=1.4): return fm(m,d,1.6,3.0,3.5)
def pad(ms,d,bright=5,att=.6):
    t=tt(d); s=np.zeros(len(t))
    for m in ms:
        for det in(-.08,0,.08):
            f=mtof(m+det); s+=sum(np.sin(2*np.pi*f*h*t+rng.uniform(0,6))/h**1.5 for h in range(1,bright+1))
    return s*np.minimum(1,t/att)*np.minimum(1,(d-t)/.5)/len(ms)/3
def pluck(m,d=.45): t=tt(d); f=mtof(m); return (np.sin(2*np.pi*f*t)+.3*np.sin(4*np.pi*f*t)+.1*np.sin(6*np.pi*f*t))*np.exp(-t*8)*np.minimum(1,t/.002)
def sub(m,d): t=tt(d); f=mtof(m); return (np.sin(2*np.pi*f*t)+.2*np.sin(4*np.pi*f*t))*np.minimum(1,t/.01)*np.minimum(1,(d-t)/.03)
def kick(): t=tt(.45); f=44+80*np.exp(-t*30); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*7)+filt(noise(.45),hi=3000)*np.exp(-t*220)*.25
def snare(): t=tt(.3); return filt(noise(.3),700,7000)*np.exp(-t*17)*.5+np.sin(2*np.pi*190*t)*np.exp(-t*25)*.35
def hat(d=.06): t=tt(d); return filt(noise(d),7000)*np.exp(-t*70)
def rim(): t=tt(.1); return filt(noise(.1),900,5000)*np.exp(-t*60)*.6+np.sin(2*np.pi*1700*t)*np.exp(-t*80)*.4
# ---- sfx
def whoosh(d=.6,lo=300,hi=4000,up=True):
    t=tt(d); n=noise(d); x=t/d; e=np.sin(np.pi*x)**2; a=filt(n,lo,lo*3); b=filt(n,hi/3,hi); m=x if up else 1-x
    return (a*(1-m)+b*m)*e
def pop(m=84,d=.12): t=tt(d); f=mtof(m)*(1+.6*np.exp(-t*60)); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*35)
def tick(f=3200): t=tt(.02); return np.sin(2*np.pi*f*t)*np.exp(-t*350)
def key(): t=tt(.045); return filt(noise(.045),1500,9000)*np.exp(-t*120)+np.sin(2*np.pi*(380+rng.uniform(-40,40))*t)*np.exp(-t*90)*.4
def click(): t=tt(.03); return filt(noise(.03),2000,10000)*np.exp(-t*200)+np.sin(2*np.pi*2200*t)*np.exp(-t*250)*.5
def boom(d=1.8): t=tt(d); f=36+44*np.exp(-t*7); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*2.1)*np.minimum(1,t/.004)
def thock(): t=tt(.35); f=70+60*np.exp(-t*35); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*14)+filt(noise(.35),hi=1200)*np.exp(-t*45)*.5
def shimmer(d=2.4,root=86):
    t=tt(d); s=np.zeros(len(t))
    for m in (0,3,7,10,14,19): s+=bell(root+m,d)*.17
    return s*np.minimum(1,t/.02)
def zap(d=.35,f0=200,f1=5000): t=tt(d); f=f0*(f1/f0)**(t/d); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.sin(np.pi*t/d)**1.5
def riser(d,f0=180,f1=2400):
    t=tt(d); x=t/d; n=noise(d); return filt(n,2000)*x**2*.5+np.sin(2*np.pi*np.cumsum(f0+(f1-f0)*x**2)/SR)*x**3*.25
def glitch(d=.25):
    t=tt(d); s=np.sign(np.sin(2*np.pi*np.cumsum(80+rng.uniform(200,1800,len(t))*(np.floor(t*60)%2))/SR))*.3
    return filt(s*(rng.random(len(t))>.3),300,6000)*np.exp(-t*4)
# ================= 0 – 3.62  LOCAL (cold) =================
add(MUS,pad([38,45,50,53],3.7,3,.8),0.25,.32)               # cold D minor drone
add(MUS,sub(26,3.3)*np.linspace(.4,1,int(3.3*SR)),.3,.22)
t=tt(3.2); add(SFX,filt(noise(3.2),hi=500)*.25*np.minimum(1,t/.5),.4,.35)  # laptop fan bed
add(SFX,pop(57,.4),0.02,.5); add(SFX,whoosh(.7,200,3000),.35,.3)
for i,(t0,cps,n) in enumerate([(.55,70,8),(.8,90,52)]):     # terminal typing
    for k in range(n):
        if rng.random()<.85: add(SFX,key(),t0+k/cps+rng.uniform(0,.006),.16,pan=rng.uniform(-.2,.2))
for t0 in (1.45,1.75,2.05): add(SFX,tick(2600),t0,.14,pan=.4)
add(SFX,whoosh(.45,300,3500),2.0,.3,pan=.4)
add(SFX,thock(),2.93,.55,pan=.3)                            # lid shuts in the clip
add(SFX,glitch(.3),w(0,6),.5); add(SFX,glitch(.18),w(0,6)+.32,.35,pan=-.3)
t=tt(.6); add(SFX,np.sin(2*np.pi*np.cumsum(900*np.exp(-t*6)+40)/SR)*np.exp(-t*3)*.6+filt(noise(.6),3000)*np.exp(-t*8)*.25,3.0,.5)  # CRT off
add(SFX,pop(72,.2),3.38,.35)
# ================= 3.6 – 7.2  CLOUD (open, airy) =================
add(SFX,whoosh(.5,150,9000,True)[::-1],3.45,.55)            # reverse swell into the bloom
add(SFX,boom(1.6),3.95,.45); add(SFX,shimmer(2.6,81),3.95,.35)
add(MUS,pad([50,57,62,65,69],3.5,6,.25),3.92,.24)
t=tt(3.4); add(SFX,filt(noise(3.4),400,2500)*(.5+.5*np.sin(2*np.pi*.4*t))*np.minimum(1,t/.4),3.95,.12,pan=-.3)  # wind
for i in range(6): add(SFX,pop(86+[0,2,4,5,7,9][i]),4.25+i*.42,.18,pan=.55)
for tf in (w(1,2),w(1,3)+.2,w(1,4)+.15,w(1,6)):
    for c in range(7): add(SFX,click(),tf+c*.03,.18,pan=-.4+c*.08)
for i,tb in enumerate(np.arange(3.95,7.2,.5)): add(MUS,pluck([74,77,81,79,77,74,72][i%7]),tb,.07,pan=.3 if i%2 else -.3)
add(SFX,whoosh(.55,300,6000),6.8,.45)
# ================= 7.2 – 22.8  GROOVE (120 BPM anchored at 7.2) =================
T0=7.2; BEAT=.5
CH=[[50,57,60,64],[46,53,57,62],[53,57,60,65],[48,55,60,64]]   # Dm9 Bbmaj7 F C
def chord(t): return CH[int((t-T0)//2)%4]
def section(a,b,lvl):
    k=int(np.ceil((a-T0)/BEAT-1e-6))
    while T0+k*BEAT<b-1e-6:
        tb=T0+k*BEAT; c=chord(tb+.01)
        add(MUS,kick(),tb,.55*lvl[0])
        if k%2: add(MUS,snare(),tb,.22*lvl[1])
        for s in range(2 if lvl[2]<1 else 4): add(MUS,hat(.05),tb+s*(.25 if lvl[2]<1 else .125),.09*lvl[2]*(1 if s%2 else .6),pan=.2)
        if lvl[3]>0:
            for s in range(2): add(MUS,pluck(c[(k*2+s)%4]+24),tb+s*.25,.07*lvl[3],pan=-.35 if s else .35)
        add(MUS,sub(c[0]-12,.46),tb,.22*lvl[4])
        if k%4==0:
            for m in c: add(MUS,epiano(m+12,1.8,.8),tb,.055,pan=rng.uniform(-.3,.3))
            add(MUS,pad([m+12 for m in c],2.2,4),tb,.08)
        k+=1
section(7.2,11.62,[.8,.6,.7,1,.8])
section(11.62,15.4,[1,1,1,.6,1.1])
section(15.4,17.4,[1,1,1.4,1,1.2])
section(17.82,22.75,[.85,.8,1,1,.9])
# connect
for k in range(5): add(SFX,key(),7.55+k/14,.15,pan=.4)
add(SFX,click(),8.3,.4,pan=.4); add(SFX,bell(91,.8),8.6,.18,pan=.4); add(SFX,bell(98,.6),8.66,.12,pan=.4)
add(SFX,whoosh(.4,300,4000),w(2,3)-.3,.3)
add(SFX,pop(81,.18),w(2,4),.3,pan=.2); add(SFX,pop(85,.18),w(2,7),.3,pan=.5)
for i in range(4): add(SFX,tick(2400+i*200),w(2,4)+.5+i*.28,.12,pan=-.5+i*.3)
# line wipe into the sandbox
add(SFX,zap(.3,300,6000),11.5,.35); add(SFX,boom(1.4),11.62,.45); add(SFX,whoosh(.5,200,3000,False),11.62,.35)
add(SFX,whoosh(.6,100,1500),w(3,1),.4)                         # layers explode
for i in range(3): add(SFX,tick(1800+i*300),w(3,5)+.15+i*.16,.18,pan=.5)
add(SFX,shimmer(1.6,93),w(3,5),.22); add(SFX,thock(),w(3,5)+.32,.35)  # glass + lock
# multiply: denser pops at each step
for t0,n in [(w(3,7)-.2,1),(w(3,8),4),(w(3,8)+.3,16),(w(3,9),64),(w(3,10),256)]:
    cnt=min(n,40)
    for j in range(cnt): add(SFX,pop(80+rng.integers(0,14),.08),t0+rng.uniform(0,.28)*(j>0),.22/np.sqrt(cnt),pan=rng.uniform(-.7,.7))
add(SFX,riser(2.0),15.4,.35); add(SFX,whoosh(.5,300,9000),17.35,.5); add(SFX,boom(1.2),17.82,.4)
# verify
add(SFX,tick(2000),18.3,.2,pan=.5); add(SFX,tick(2000),18.42,.2,pan=.5)       # REC
for i,t0 in enumerate([w(4,3),w(4,3)+.35,w(4,4),w(4,6)+.35]): add(SFX,bell(86+[0,3,7,12][i],.9),t0,.22,pan=-.4)
add(SFX,click(),19.28,.4,pan=.5); add(SFX,bell(93,.6),19.35,.14,pan=.5)
add(SFX,whoosh(.5,300,5000),w(4,6)+.05,.4,pan=-.2)
add(SFX,click(),w(4,9),.45); add(SFX,shimmer(1.8,86),w(4,9)+.02,.3); add(SFX,boom(1.0),w(4,9),.25)
# ================= 22.75 – 26.2  SWARM (breakdown) =================
t=tt(.5); add(SFX,filt(noise(.5),3000)*np.sin(np.pi*t/.5)**2,22.75,.35)          # halftone dissolve
add(MUS,pad([50,57,62,65,69,72],3.6,6,.3),22.8,.26)
add(MUS,sub(38,3.2)*np.linspace(.3,1,int(3.2*SR)),22.9,.18)
t=tt(2.9); fl=filt(noise(2.9),1200,6000)*(.4+.6*np.abs(np.sin(2*np.pi*7*t)))*np.minimum(1,t/.6); add(SFX,fl,23.25,.14,pan=.2)  # swarm flutter
for j in range(70): add(SFX,tick(2600+rng.integers(0,2400)),23.3+rng.uniform(0,2.6),.05,pan=rng.uniform(-.8,.8))
add(SFX,riser(1.0,300,3000),25.0,.4)
for i,tb in enumerate(np.arange(23.2,25.9,.25)): add(MUS,pluck([74,77,81,84][i%4]+(0 if i<6 else 12)),tb,.05,pan=.4 if i%2 else -.4)
# ================= 26.2 – 30  LOGO / LID / END =================
add(SFX,boom(2.4),w(6,0),.6); add(SFX,shimmer(3.0,86),w(6,0),.35); add(SFX,whoosh(.5,300,8000,False),w(6,0),.3)
fin=[38,50,57,62,65,69,74]
for m in fin: add(MUS,epiano(m+12,3.6,.9),w(6,0),.055)
add(MUS,pad([m+12 for m in fin[1:]],3.7,5,.15),w(6,0),.22); add(MUS,sub(26,3.4),w(6,0),.28)
add(SFX,whoosh(.55,300,4000),26.72,.3)
t=tt(.55); add(SFX,filt(noise(.55),200,1500)*np.sin(np.pi*t/.55)*.6,w(6,3),.25)                # hinge air
add(SFX,thock(),w(6,3)+.52,.55)                                                                # lid closes
add(SFX,pop(84,.2),w(6,3)+.55,.25,pan=.2)
add(SFX,whoosh(.5,300,5000),28.45,.3); add(SFX,shimmer(1.6,93),28.8,.2)
# ---- master: reverb sends
def conv(x,h):
    n=1<<int(np.ceil(np.log2(len(x)+len(h)))); return np.fft.irfft(np.fft.rfft(x,n)*np.fft.rfft(h,n),n)[:len(x)]
ir=np.exp(-tt(2.0)*2.6)
for c in range(2):
    h=filt(rng.standard_normal(len(ir))*ir,hi=7000); h/=np.sqrt((h**2).sum())
    MUS[:,c]+=.2*conv(MUS[:,c],h); SFX[:,c]+=.13*conv(SFX[:,c],h)
# ---- voiceover: HPF, presence, gentle compression
VO=np.zeros(N)
for i,l in enumerate(tl):
    a,sr=sf.read(f'vo/L{i}.wav'); a=np.interp(np.arange(int(len(a)*SR/sr))*(sr/SR),np.arange(len(a)),a)
    a/=np.abs(a).max(); s=int(round(l['start']*SR)); VO[s:s+len(a)]+=a[:N-s]
VO=filt(VO,lo=80)
X=np.fft.rfft(VO); f=np.fft.rfftfreq(N,1/SR); X*=1+.32*np.exp(-((f-3000)/1400)**2)+.12*np.exp(-((f-140)/60)**2)-.15*np.exp(-((f-320)/140)**2); VO=np.fft.irfft(X,N)
e=np.sqrt(np.convolve(VO**2,np.ones(960)/960,'same')); thr=.16; g=np.where(e>thr,(thr/np.maximum(e,1e-9))**.45,1.0)
VO*=np.convolve(g,np.ones(240)/240,'same'); VO/=np.abs(VO).max()
act=np.convolve((np.convolve(np.abs(VO),np.ones(2400)/2400,'same')>.015).astype(float),np.ones(7200)/7200,'same'); duck=1-.48*np.clip(act,0,1)
MUS/=np.abs(MUS).max(); SFX/=np.abs(SFX).max()
bed=(MUS*.55+SFX*.6)*duck[:,None]
tf=np.arange(N)/SR; fade=np.clip((DUR-tf)/.9,0,1)**1.3*np.clip(tf/.01,0,1)
mix=(bed*.5+VO[:,None]*.78)*fade[:,None]
mix=np.tanh(mix*1.1)/np.tanh(1.1); mix/=np.abs(mix).max(); mix*=.9
def wr(n,x):
    with wave.open(n,'wb') as o:
        o.setnchannels(2); o.setsampwidth(3); o.setframerate(SR); x=np.clip(x,-1,1); b=(x*8388607).astype('<i4')
        o.writeframes(np.stack([b&0xff,(b>>8)&0xff,(b>>16)&0xff],-1).astype(np.uint8).tobytes())
wr('mix.wav',mix); wr('bed.wav',np.clip(bed*.5*fade[:,None],-1,1)); wr('vo_only.wav',np.clip(np.stack([VO,VO],1)*.78*fade[:,None],-1,1))
print('ok')
