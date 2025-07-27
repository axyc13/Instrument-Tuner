import React, { useEffect, useRef, useState } from 'react';
import './Tuner.css';

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function frequencyToNoteData(frequency) {
  const A4 = 440; // 440Hz Tuning
  const noteNumRelativeA4 = Math.round(69 + 12 * Math.log2(frequency / A4)); // In relation to A4
  const noteName = noteNames[noteNumRelativeA4 % 12]; 
  const octave = Math.floor(noteNumRelativeA4 / 12) - 1; 
  const exactFreq = A4 * (2 ** ((noteNumRelativeA4 - 69) / 12)); 
  const cents = 1200 * Math.log2(frequency / exactFreq); // 1200 cents per octave
  
  return {
    note: `${noteName}${octave}`,
    cents,
    exactFreq,
  };
}

function autoCorrelate(buffer, sampleRate) {
  const size = buffer.length;
  let rms = 0;

  // Calculate RMS for signal strength
  for (let i = 0; i < size; i++) {
    const sampleValue = buffer[i];
    rms += sampleValue * sampleValue;
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) { 
    return null; // Not enough signal to detect pitch
  } 

  // Auto-correlation algorithm to find most likely period (pitch)
  let bestOffset = -1;
  let bestCorrelation = 0;

  // Find the best offset for correlation
  for (let offset = 8; offset < size / 2; offset++) {
    let correlation = 0;
    for (let i = 0; i < size / 2; i++) {
      correlation += buffer[i] * buffer[i + offset];
    }
  
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }
  // If no good offset found, return null
  if (bestCorrelation > 0.01 && bestOffset !== -1) {
    return sampleRate / bestOffset; 
  }
  return null;
}

export default function Tuner() {
  const [note, setNote] = useState(null);
  const [freq, setFreq] = useState(null);
  const [cents, setCents] = useState(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); 
      const audioContext = new AudioContext(); 
      audioContextRef.current = audioContext; // Storing data in ref

      // Create a media source node, analyser node and connect them
      const source = audioContext.createMediaStreamSource(stream); 
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      // Create a buffer to store the data
      const buffer = new Float32Array(analyser.fftSize); 
      analyserRef.current = analyser; 
      dataArrayRef.current = buffer; 

      // Retrieve data from refs and detect pitch
      const detect = () => {
        analyser.getFloatTimeDomainData(buffer); 
        const detectedPitch = autoCorrelate(buffer, audioContext.sampleRate);

        // If a pitch is detected, convert it to notes
        if (detectedPitch) {
          const { note, cents } = frequencyToNoteData(detectedPitch);
          setFreq(detectedPitch.toFixed(1)); // 1 d.p.
          setNote(note);
          setCents(cents);
        } else {
          setFreq(null);
          setNote(null);
          setCents(null);
        }

        requestAnimationFrame(detect); // Recursively call detect
      };

      detect(); 
    };

    init(); 

    return () => {
      audioContextRef.current?.close(); // Close audio context when component unmounts
    };
  }, []);

const clampedCents = Math.max(-50, Math.min(50, cents ?? 0));
const needleAngle = clampedCents * 1.8;
const tickPositions = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];

return ( 
  <div className = "tuner-container"> 
    <h1 className = "tuner-title">Tuner</h1> 
      {note ? (
        <>
          <h2 className = "tuner-pitch">
            <span className = "note-text">{note}</span>
          </h2>
          <p className = "tuner-frequency">{freq} Hz</p>
          <p className = "tuner-cents">
            {cents > 0 ? '+' : ''} 
            {cents?.toFixed(1)} cents 
          </p>
        </>
      ) : (
        <>
          <h2 className = "tuner-pitch">...</h2>
          <p className = "tuner-frequency">- HZ</p>
          <p className = "tuner-cents">- Cents</p>
        </>
      )}
      <div className = "needle-wrapper">
        {tickPositions.map((pos) => (
          <div
            key = {pos}
            className = {`tick ${pos % 25 === 0 ? 'major' : 'minor'}`}
            style = {{
            transform: `translateX(-50%) rotate(${pos * 1.8}deg) translateY(-65px)`,
            }}
          />
        ))}

        {tickPositions.map((pos) => (
          <div
            key = {`${pos}-label`}
            className = "tick-label"
            style = {{
              transform: `translateX(-50%) rotate(${pos * 1.8}deg) translateY(-95px) rotate(${-pos * 1.8}deg)`,
            }}
          >
            {pos > 0 ? `+${pos}` : pos}
          </div>
        ))}

        <div
          className = {`needle ${Math.abs(cents ?? 999) <= 10 ? 'in-tune' : ''}`}
          style = {{ transform: `translateX(-50%) rotate(${needleAngle}deg)` }}
        />

        <div className = "center-line" />
      </div>
  </div>
);
}
