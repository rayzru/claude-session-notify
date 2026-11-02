#!/usr/bin/env python3
"""Synthesizes the notification sounds into sounds/. Run by hand; the files are checked in.

The notifying app carries its own, so a macOS update cannot take them away, and they are
ours to ship: the system's sounds are Apple's. Only the standard library.
"""
import math
import struct
import wave
from pathlib import Path

RATE = 44100
PEAK = 0.7

# Each sound: its strokes as (start in seconds, [(frequency, level, decay per second)]).
GLASS = [(1.0, 1.0, 7.0), (2.76, 0.45, 12.0), (5.4, 0.2, 20.0)]
SOUNDS = {
    'done': (0.7, [(0.0, [(f * 1318.5, level, decay) for f, level, decay in GLASS])]),
    'waiting': (0.6, [
        (0.0, [(f * 1046.5, level, decay) for f, level, decay in GLASS]),
        (0.14, [(f * 1568.0, level, decay) for f, level, decay in GLASS]),
    ]),
    'error': (0.5, [
        (0.0, [(196.0, 1.0, 9.0), (392.0, 0.35, 14.0)]),
        (0.16, [(164.8, 1.0, 9.0), (329.6, 0.35, 14.0)]),
    ]),
}
ATTACK = 0.004  # seconds: a stroke that starts at full level clicks


def render(length, strokes):
    samples = [0.0] * int(length * RATE)
    for start, partials in strokes:
        first = int(start * RATE)
        for i in range(first, len(samples)):
            t = (i - first) / RATE
            onset = min(t / ATTACK, 1.0)
            for frequency, level, decay in partials:
                samples[i] += onset * level * math.exp(-decay * t) * math.sin(2 * math.pi * frequency * t)
    loudest = max(abs(s) for s in samples)
    fade = int(0.02 * RATE)  # the tail ends at silence, not on a step
    for i in range(fade):
        samples[-1 - i] *= i / fade
    return [s * PEAK / loudest for s in samples]


def main():
    out = Path(__file__).parent / 'sounds'
    out.mkdir(exist_ok=True)
    for name, (length, strokes) in SOUNDS.items():
        frames = b''.join(struct.pack('<h', round(s * 32767)) for s in render(length, strokes))
        with wave.open(str(out / f'{name}.wav'), 'wb') as file:
            file.setnchannels(1)
            file.setsampwidth(2)
            file.setframerate(RATE)
            file.writeframes(frames)


if __name__ == '__main__':
    main()
