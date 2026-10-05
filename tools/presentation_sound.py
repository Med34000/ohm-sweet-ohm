"""Partition et sound design originaux ÉLAN — 2026-09-22, Codex / OpenAI.
Aucun échantillon, morceau existant ou service extérieur utilisé.
"""
import sys
import wave
from pathlib import Path
import numpy as np

SR, DURATION = 48000, 36
mix = np.zeros((SR * DURATION, 2), dtype=np.float64)
rng = np.random.default_rng(220926)

def add(signal, at, level=1, pan=0):
    first = int(at * SR)
    if first < 0:
        signal = signal[-first:]
        first = 0
    length = min(len(signal), len(mix) - first)
    if length <= 0:
        return
    left = np.sqrt((1-pan)/2)
    right = np.sqrt((1+pan)/2)
    mix[first:first+length, 0] += signal[:length] * level * left
    mix[first:first+length, 1] += signal[:length] * level * right

def note(midi):
    return 440 * 2 ** ((midi - 69) / 12)

def env(t, attack, release, length):
    return np.minimum(t/attack, 1) * np.clip((length-t)/release, 0, 1)

# F# minor / D / A / E: airy, restrained and optimistic.
chords = [[54,57,61,68], [50,54,57,64], [45,49,52,59], [52,56,59,66]]
for bar, start in enumerate(np.arange(0, DURATION, 4.0)):
    chord = chords[bar % 4]
    t = np.arange(int(SR*5.2))/SR
    envelope = env(t,.8,1.3,5.2)
    for voice, midi in enumerate(chord):
        f = note(midi)
        pad = (np.sin(2*np.pi*f*t) + .24*np.sin(2*np.pi*f*1.002*t+.6)
               + .13*np.sin(2*np.pi*f*2*t)) * envelope
        pad *= 1 + .055*np.sin(2*np.pi*.14*t)
        add(pad,start,.033,(-.5,-.17,.17,.5)[voice])

for step, start in enumerate(np.arange(1.0, 34.0, .25)):
    chord = chords[int(start/4) % 4]
    midi = chord[[0,2,1,3,2,1,3,2][step % 8]] + 12
    t = np.arange(int(SR*.65))/SR
    f=note(midi)
    ping=np.sin(2*np.pi*f*t+.38*np.sin(2*np.pi*f*2*t)*np.exp(-t*14))
    ping*=np.exp(-t*7.5)*np.minimum(t/.012,1)*np.clip((.65-t)/.12,0,1)
    gain=.021 if start<8 else .029
    add(ping,start,gain,.32*np.sin(step*1.7))
    add(ping,start+.375,gain*.20,-.32*np.sin(step*1.7))

for beat, start in enumerate(np.arange(4, 33.0, .5)):
    t=np.arange(int(SR*.38))/SR
    kick=np.sin(2*np.pi*(47*t + 48*(1-np.exp(-t*25))/25))*np.exp(-t*14)
    kick*=np.minimum(t/.003,1)
    add(kick,start,.19 if start>=8 else .11)
    chord=chords[int(start/4)%4]
    f=note(chord[0]-12)
    t=np.arange(int(SR*.46))/SR
    bass=(np.sin(2*np.pi*f*t)+.2*np.sin(2*np.pi*f*2*t))*env(t,.025,.11,.46)
    add(bass,start+.03,.081)
    if beat%2:
        t=np.arange(int(SR*.15))/SR
        noise=rng.standard_normal(len(t))
        snap=(noise-np.roll(noise,1))*.3*np.exp(-t*34)
        snap+=np.sin(2*np.pi*178*t)*np.exp(-t*45)*.25
        add(snap,start,.041)
    t=np.arange(int(SR*.045))/SR
    noise=rng.standard_normal(len(t))
    hat=(noise-np.roll(noise,1))*.25*np.exp(-t*110)
    add(hat,start+.25,.038,(-1)**beat*.4)

for at in [4,8,12,16.5,22,25.5,29,32]:
    duration=.85
    t=np.arange(int(SR*duration))/SR
    raw=rng.standard_normal(len(t))
    spectrum=np.fft.rfft(raw)
    freqs=np.fft.rfftfreq(len(raw),1/SR)
    spectrum*=np.exp(-.5*((freqs-1600)/1150)**2)
    air=np.fft.irfft(spectrum,n=len(raw))
    air/=max(np.max(np.abs(air)),1e-8)
    air*=np.sin(np.pi*t/duration)**1.5
    add(air,at-.6,.065,.12)
    t=np.arange(int(SR*.7))/SR
    impact=np.sin(2*np.pi*(48*t+20*(1-np.exp(-t*8))/8))*np.exp(-t*8)
    add(impact,at,.07)

# Clear but gentle resolving chime for the final invitation.
for i,midi in enumerate([66,73,78]):
    t=np.arange(int(SR*3.4))/SR
    chime=np.sin(2*np.pi*note(midi)*t)*np.exp(-t*1.65)*np.minimum(t/.015,1)
    add(chime,32+i*.13,.047,(i-1)*.25)

timeline=np.arange(len(mix))/SR
mix*=np.minimum(timeline/.7,1)[:,None]
mix*=np.minimum((DURATION-timeline)/1.1,1)[:,None]
peak=np.max(np.abs(mix))
mix=np.tanh(mix/peak*.78)
mix*=.83/max(np.max(np.abs(mix)),1e-8)
destination=Path(sys.argv[1])
destination.parent.mkdir(parents=True,exist_ok=True)
with wave.open(str(destination),'wb') as output:
    output.setnchannels(2);output.setsampwidth(2);output.setframerate(SR)
    output.writeframes((mix*32767).astype('<i2').tobytes())
print(destination)
