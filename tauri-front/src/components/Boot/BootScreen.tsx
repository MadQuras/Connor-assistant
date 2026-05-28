import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ConnorLogo } from '../Logo/ConnorLogo';

interface BootScreenProps {
  onFinish: () => void;
}

const BOOT_LINES = [
  { label: 'CYBERLIFE OS',         result: 'v4.2.1' },
  { label: 'ПРОЦЕССОР',            result: 'OK' },
  { label: 'НЕЙРОННАЯ СЕТЬ',       result: 'OK' },
  { label: 'STT WHISPER',          result: 'OK' },
  { label: 'VAD SILERO',           result: 'OK' },
  { label: 'OCR TESSERACT',        result: 'OK' },
  { label: 'OPENJARVIS CORE',      result: 'OK' },
  { label: 'КЭШИРОВАННЫЕ ДАННЫЕ',  result: 'OK' },
  { label: 'АУДИО МОДУЛИ',         result: 'OK' },
  { label: 'ГОЛОСОВОЙ ПРОФИЛЬ',    result: 'OK' },
  { label: 'ИНТЕРФЕЙС',            result: 'OK' },
  { label: 'СИСТЕМА',              result: 'ГОТОВ' },
];

const LINE_DELAY = 1400;
const LAST_LINE_IDX = BOOT_LINES.length - 1;

export function BootScreen({ onFinish }: BootScreenProps) {
  const [revealed, setRevealed] = useState(0);
  const [waitingForPython, setWaitingForPython] = useState(false);
  const [pythonReady, setPythonReady] = useState(false);
  const [done, setDone] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Reveal lines 0..LAST_LINE_IDX-1 on timer, then show last line with "ОЖИДАНИЕ..."
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Reveal all lines except the last on schedule
    for (let i = 0; i < LAST_LINE_IDX; i++) {
      const idx = i;
      timers.push(
        setTimeout(() => {
          setRevealed(idx + 1);
        }, 600 + idx * LINE_DELAY)
      );
    }

    // Show last line (with ОЖИДАНИЕ... state) after all others
    timers.push(
      setTimeout(() => {
        setRevealed(BOOT_LINES.length);
        setWaitingForPython(true);
      }, 600 + LAST_LINE_IDX * LINE_DELAY)
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  // Once last line appears, start polling check_python_ready every 800ms
  useEffect(() => {
    if (!waitingForPython) return;

    pollRef.current = setInterval(async () => {
      try {
        const ready = await invoke<boolean>('check_python_ready');
        if (ready) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPythonReady(true);
          // Wait 600ms then show "КОННОР АКТИВЕН", fade out, call onFinish
          setTimeout(() => setDone(true), 600);
          setTimeout(() => setFadeOut(true), 1400);
          setTimeout(() => onFinishRef.current(), 2200);
        }
      } catch {
        // ignore errors — keep polling
      }
    }, 800);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [waitingForPython]);

  const pct = Math.round((revealed / BOOT_LINES.length) * 100);

  return (
    <div className={`boot-root${fadeOut ? ' fade-out' : ''}`}>
      <div className="grid-bg" />
      <div className="scanline" />
      <div className="corner corner-tl" /><div className="corner corner-tr" />
      <div className="corner corner-bl" /><div className="corner corner-br" />

      <div className="boot-container">
        {/* Logo */}
        <div className="boot-logo-section">
          <div className="boot-ring2" /><div className="boot-ring1" />
          <ConnorLogo size={62} animated />
        </div>
        <div className="boot-name">КОННОР</div>
        <div className="boot-sub">CYBERLIFE SYSTEMS · ANDROID RK800</div>

        {/* Terminal */}
        <div className="boot-terminal">
          <div className="boot-term-hd">
            <span className="boot-term-dot" /><span className="boot-term-dot" /><span className="boot-term-dot" />
            <span className="boot-term-title">BOOT SEQUENCE v4.2.1</span>
          </div>
          <div className="boot-term-body">
            {BOOT_LINES.slice(0, revealed).map((line, i) => {
              const isLastLine = i === LAST_LINE_IDX;
              let resultText: string;
              let resultClass: string;

              if (isLastLine) {
                if (pythonReady) {
                  resultText = 'ГОТОВ';
                  resultClass = 'boot-result green';
                } else {
                  resultText = 'ОЖИДАНИЕ...';
                  resultClass = 'boot-result'; // default cyan color
                }
              } else {
                resultText = line.result;
                resultClass = 'boot-result';
              }

              return (
                <div className="boot-line" key={i}>
                  <span className="boot-lbl">{line.label}</span>
                  <span className="boot-dots">{'·'.repeat(Math.max(4, 24 - line.label.length))}</span>
                  <span className={resultClass}>{resultText}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress */}
        {revealed > 0 && (
          <div className="boot-prog-wrap">
            <div className="boot-prog-track">
              <div className="boot-prog-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="boot-prog-labels">
              <span>
                {!pythonReady && waitingForPython
                  ? 'ОЖИДАНИЕ ЯДРА...'
                  : revealed < BOOT_LINES.length
                    ? `${BOOT_LINES[revealed - 1]?.label}...`
                    : 'ЗАВЕРШЕНО'}
              </span>
              <span>{pct}%</span>
            </div>
          </div>
        )}

        {/* Final message */}
        {done && (
          <div className="boot-final">
            КОННОР АКТИВЕН<span className="boot-cursor" />
          </div>
        )}
      </div>

      <div className="boot-bottom">
        <span>CYBERLIFE OS v4.2.1</span>
        <span>RK800 #313 248 317</span>
      </div>
    </div>
  );
}
