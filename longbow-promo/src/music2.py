import numpy as np, wave, json, soundfile as sf
SR=48000; DUR=30.0; N=int(SR*DUR); rng=np.random.default_rng(1)
M=np.zeros((N,2)); FX=np.zeros((N,2))
def tt(d): return np.arange(int(d*SR))/SR
def add(buf,sig,t0,g=1.0,pan=0.0):
    i=int(t0*SR)
    if i>=N or i<0: return
    s=sig[:N-i]*g; buf[i:i+len(s),0]+=s*np.sqrt((1-pan)/2)*1.414; buf[i:i+len(s),1]+=s*np.sqrt((1+pan)/2)*1.414
def mtof(m): return 440*2**((m-69)/12)
def lp(x,k): return np.convolve(x,np.ones(k)/k,mode='same')
def saw(f,t,h): return sum(np.sin(2*np.pi*f*k*t)/k for k in range(1,h+1))
CH=[[57,60,64],[53,57,60],[48,55,60,64],[55,59,62]]
DROP=10.55; END=26.0
# pad: 2s chords all the way, resolves on END
for bar in range(13):
    t0=bar*2.0; d=min(2.3,END-t0+0.1)
    if d<=0: break
    t=tt(d); env=np.minimum(1,t/.35)*np.minimum(1,(d-t)/.3); h=3 if t0<DROP else 5
    for j,m in enumerate(CH[bar%4]):
        for det in(-.07,.07): add(M,saw(mtof(m+12+det),t,h)*env,t0,.026,pan=det*6*(1 if j%2 else -1))
# pluck arp
def pluck(f,d=.5):
    t=tt(d); return (np.sin(2*np.pi*f*t)+.35*np.sin(4*np.pi*f*t))*np.exp(-t*8)
for k in range(int(30/.25)):
    t0=k*.25; c=CH[int(t0//2)%4]
    if t0<7.6: 
        if k%2: continue
        g=.12
    elif DROP<=t0<25.2: g=.085
    else: continue
    add(M,pluck(mtof(c[k%len(c)]+24+(12 if (k//4)%2 and t0>DROP else 0))),t0,g,pan=.35 if k%2 else -.35)
# "idle" wind-down: descending tone
t=tt(.9); f=900*np.exp(-t*2.2); add(FX,np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*3)*.5,7.62,.18)
# drums from DROP to 25.2, anchored to DROP
def kick():
    t=tt(.4); f=45+90*np.exp(-t*28); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*7)+np.exp(-t*300)*.3
def hat(d=.05):
    n=rng.standard_normal(int(d*SR)); n=np.diff(np.diff(n,prepend=0),prepend=0); return n*np.exp(-tt(d)*80)*.2
def clap():
    t=tt(.22); n=rng.standard_normal(len(t)); n=n-lp(n,12); return n*np.exp(-t*20)*.45
K=kick(); KT=[]
b=0
while DROP+b*.5<25.2:
    t0=DROP+b*.5; add(M,K,t0,.55); KT.append(t0)
    if b%2: add(M,clap(),t0,.28)
    add(M,hat(),t0+.25,.35,pan=.2); b+=1
# sub bass
for k in range(int((25.2-DROP)/.25)):
    t0=DROP+k*.25; m=CH[int(t0//2)%4][0]-12; t=tt(.24)
    add(M,(np.sin(2*np.pi*mtof(m)*t)+.25*np.sin(4*np.pi*mtof(m)*t))*np.minimum(1,t/.005)*np.exp(-t*4),t0,.2)
# ---- FX
def whoosh(d=.6,up=True):
    t=tt(d); n=rng.standard_normal(len(t)); lo=lp(n,40); hi=n-lp(n,6); x=t/d; mix=x if up else 1-x
    return (lo*(1-mix)*3+hi*mix*.8)*np.sin(np.pi*x)**2*.5
for tc in (3.45,13.1,22.1): add(FX,whoosh(),tc-.3,.35,pan=-.3)
add(FX,whoosh(1.2),0.0,.3,pan=.4)            # ribbon sweep
for tc in (17.6,25.2): add(FX,whoosh(.7),tc-.35,.35)
# tension 8.3..DROP: riser + bow creak
d=DROP-8.3; t=tt(d); x=t/d; n=rng.standard_normal(len(t))
add(FX,((n-lp(n,4))*x**2*.3+np.sin(2*np.pi*np.cumsum(200+1200*x**2)/SR)*x**3*.1)*np.minimum(1,(d-t)/.03),8.3,.35)
f=70+30*x+3*np.sin(2*np.pi*7*t); add(FX,lp(np.sign(np.sin(2*np.pi*np.cumsum(f)/SR))*.5,30)*x**1.5,8.3,.12)
# release twang + snap + whoosh
t=tt(1.2); f=110*(1+.5*np.exp(-t*20))
add(FX,np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*5)+.5*np.sin(2*np.pi*np.cumsum(2.01*f)/SR)*np.exp(-t*8),DROP,.35)
add(FX,rng.standard_normal(2400)*np.exp(-tt(.05)*90),DROP,.35); add(FX,whoosh(.6,False),DROP,.5)
# APY counter ticks
for i in range(16):
    tc=15.82+1.4*(1-(1-i/16)**2); tk=tt(.02); add(FX,np.sin(2*np.pi*2400*tk)*np.exp(-tk*300),tc,.12,pan=.4)
# market crash blip + cage lock
tl=json.load(open('vo/timeline.json')); w=lambda l,i: tl[l]['start']+tl[l]['words'][i][1]
tk=tt(.25); add(FX,np.sin(2*np.pi*(320-120*tk/.25)*tk)*np.exp(-tk*10)*(np.sin(2*np.pi*14*tk)>0),w(4,2),.12)
tk=tt(.2); add(FX,(np.sin(2*np.pi*180*tk)+rng.standard_normal(len(tk))*.3)*np.exp(-tk*30),w(4,3)+.35,.25)
# row highlight blips
for tc in (w(5,0),w(5,5)):
    tk=tt(.12); add(FX,np.sin(2*np.pi*1320*tk)*np.exp(-tk*40),tc,.12)
# arrow in + thunk on bullseye
add(FX,whoosh(.4),25.5,.45,pan=-.5)
t=tt(.9); f=40+80*np.exp(-t*30)
th=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*6)+np.sin(2*np.pi*230*t)*np.exp(-t*14)*.5+lp(rng.standard_normal(len(t)),8)*np.exp(-t*40)*1.2
add(FX,th,25.88,.7)
# end: soft resolve chord + shimmer
t=tt(4.0)
for m in (45,57,60,64,69,76): add(M,saw(mtof(m),t,4)*np.exp(-t*.55)*np.minimum(1,t/.03),26.0,.03,pan=(m%3-1)*.3)
n=rng.standard_normal(len(t)); add(FX,(n-lp(n,3))*np.exp(-t*1.4)*.2,26.0,.3)
# ---- reverb on music
ir=np.exp(-tt(1.6)*3.4)
def conv(x,h):
    n=1<<int(np.ceil(np.log2(len(x)+len(h)))); return np.fft.irfft(np.fft.rfft(x,n)*np.fft.rfft(h,n),n)[:len(x)]
for c in range(2):
    h=rng.standard_normal(len(ir))*ir; h/=np.sqrt((h**2).sum()); M[:,c]+=.2*conv(M[:,c],h)
# ---- voiceover track
VO=np.zeros(N)
for i,l in enumerate(tl):
    a,sr=sf.read(f'vo/L{i}.wav'); a=np.interp(np.arange(0,len(a)*SR/sr)/(SR/sr),np.arange(len(a)),a)  # 24k->48k
    a=a-lp(a,160)*0.6   # tame low-end rumble a bit
    a/=np.abs(a).max(); s=int(l['start']*SR); VO[s:s+len(a)]+=a[:N-s]
# gentle compression on VO
env=lp(np.abs(VO),480); gain=np.where(env>.18,(.18/np.maximum(env,1e-6))**.4,1.0); VO*=gain; VO/=np.abs(VO).max()
# duck music + fx under VO (smoothed)
act=lp((lp(np.abs(VO),2400)>.02).astype(float),9600)
duck=1-.55*np.clip(act,0,1)
MUS=(M+FX*.9)*duck[:,None]
MUS/=np.abs(MUS).max()
tf=np.arange(N)/SR; fade=np.clip((DUR-tf)/1.0,0,1)**1.5*np.clip(tf/.02,0,1)
mix=(MUS*.42+VO[:,None]*.80)*fade[:,None]
mix=np.tanh(mix*1.15); mix/=np.abs(mix).max(); mix*=.89
def wr(name,x):
    with wave.open(name,'wb') as w_: w_.setnchannels(2); w_.setsampwidth(2); w_.setframerate(SR); w_.writeframes((x*32767).astype('<i2').tobytes())
wr('mix.wav',mix); wr('music_only.wav',np.clip(MUS*.42*fade[:,None],-1,1)); wr('vo_only.wav',np.clip(np.stack([VO,VO],1)*.8,-1,1))
print('ok')
