import { useState, useEffect, ReactNode } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ConnorLogo } from '../Logo/ConnorLogo';

type Tab = 'dashboard' | 'commands' | 'notes' | 'devices' | 'settings';

const LABELS: Record<Tab, string> = {
  dashboard: 'ГЛАВНАЯ',
  commands: 'КОМАНДЫ',
  notes: 'ПАМЯТЬ',
  devices: 'УСТРОЙСТВА',
  settings: 'НАСТРОЙКИ',
};

const TIPS = [
  { tag: 'ЭФФЕКТИВНОСТЬ', text: 'Лейтенант, Win+D мгновенно сворачивает все окна.' },
  { tag: 'БЕЗОПАСНОСТЬ', text: 'Win+L блокирует систему. Рекомендую применять при каждом отходе от ПК.' },
  { tag: 'НАВИГАЦИЯ', text: 'Alt+Tab быстрее мыши. Андроиды это знают. Теперь знаете и вы.' },
  { tag: 'СИСТЕМА', text: 'Ctrl+Shift+Esc открывает диспетчер задач напрямую. Без лишних шагов.' },
  { tag: 'ФАЙЛЫ', text: 'Win+E — проводник. Не нужно его искать по меню.' },
  { tag: 'СКРИНШОТ', text: 'Win+Shift+S — выделить область экрана. Точнее чем PrintScreen.' },
];

function useClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const fmt = () => {
      const n = new Date();
      const p = (v: number) => String(v).padStart(2, '0');
      setTime(`${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`);
    };
    fmt();
    const id = setInterval(fmt, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function LeftPanel() {
  const time = useClock();
  const [tipIdx, setTipIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    let mounted = true;
    const runTip = (idx: number) => {
      setVisible(false);
      setDisplayed('');
      setTimeout(() => {
        if (!mounted) return;
        setVisible(true);
        const text = TIPS[idx].text;
        let ci = 0;
        const iv = setInterval(() => {
          if (!mounted) { clearInterval(iv); return; }
          ci++;
          setDisplayed(text.slice(0, ci));
          if (ci >= text.length) {
            clearInterval(iv);
            setTimeout(() => {
              if (!mounted) return;
              const next = (idx + 1) % TIPS.length;
              setTipIdx(next);
              runTip(next);
            }, 4000);
          }
        }, 35);
      }, 400);
    };
    const timeout = setTimeout(() => runTip(tipIdx), 800);
    return () => { mounted = false; clearTimeout(timeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shortTime = time.slice(0, 5);

  return (
    <div className="left-panel">
      <div className="lp-scan" />
      <div className="lp-top">
        <div className="lp-tri-row">
          <ConnorLogo size={20} animated />
          <div>
            <div className="lp-name">КОННОР</div>
            <div className="lp-rk">CYBERLIFE · RK800</div>
          </div>
        </div>
      </div>
      <div className="lp-status">
        <div className="lp-dot" />
        <div className="lp-status-txt">АКТИВЕН</div>
        <div className="lp-status-time">{shortTime}</div>
      </div>
      <div className="lp-tips">
        <div className="lp-tip-label">СОВЕТЫ КОННОРА</div>
        <div className="tip-slot">
          <div className={`tip-bubble ${visible ? 'visible' : ''}`}>
            <div className="tip-tag">{TIPS[tipIdx].tag}</div>
            <div className="tip-text">
              {displayed}
              {visible && <span className="tip-cursor" />}
            </div>
          </div>
        </div>
        <div className="tip-progress">
          {TIPS.map((_, i) => (
            <div key={i} className={`tip-pip${i === tipIdx ? ' active' : ''}`} />
          ))}
        </div>
      </div>
      <div className="lp-footer">
        <div className="lp-footer-txt">
          CYBERLIFE SYSTEMS<br />ANDROID DIVISION<br />BUILD 001 · 2026
        </div>
      </div>
    </div>
  );
}

// BottomBar removed — replaced by left slide-out text overlay (PyQt5)


export function Shell({ children }: { children: (tab: Tab) => ReactNode }) {
  const [tab, setTab]       = useState<Tab>('dashboard');
  const [pageKey, setPageKey] = useState(0);
  const clock = useClock();

  const changeTab = (t: Tab) => {
    setTab(t);
    setPageKey(k => k + 1);  // remounts page → triggers page-enter animation
  };

  const handleMin = () => getCurrentWindow().minimize();
  const handleMax = () => getCurrentWindow().toggleMaximize();
  const handleClose = () => getCurrentWindow().close();

  return (
    <>
      <div className="grid-bg" />
      <div className="scanline" />
      <div className="corner corner-tl" />
      <div className="corner corner-tr" />
      <div className="corner corner-bl" />
      <div className="corner corner-br" />

      <div className="app">
        {/* TITLEBAR */}
        <div className="titlebar" data-tauri-drag-region>
          <div className="tb-logo">
            <ConnorLogo size={22} style={{ flexShrink: 0 }} className="eye-blink" />
            <div className="tb-name" data-text="КОННОР">КОННОР</div>
            <div className="tb-ver">RK800</div>
          </div>
          <div className="tb-center">
            <div className="tb-chip active">
              <span className="tb-chip-dot" />АКТИВЕН
            </div>
            <div className="tb-chip standby">STANDBY</div>
          </div>
          <div className="tb-right">
            <div className="tb-clock">{clock}</div>
            <div className="tb-id">#313 248 317</div>
            <div className="winbtns">
              <div className="wbtn min" onClick={handleMin}>─</div>
              <div className="wbtn max" onClick={handleMax}>□</div>
              <div className="wbtn cls" onClick={handleClose}>✕</div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="tabs">
          {(Object.keys(LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`tab${tab === t ? ' active' : ''}`}
              onClick={() => changeTab(t)}
            >
              <div className="tab-dot" />
              {LABELS[t]}
            </button>
          ))}
        </div>

        {/* BODY */}
        <div className="body">
          <LeftPanel />
          <div key={pageKey} className="page page-enter">{children(tab)}</div>
        </div>

      </div>
    </>
  );
}
