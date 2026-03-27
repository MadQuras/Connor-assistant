const rouletteOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]

const TWO_PI = Math.PI * 2

function getRouletteColor(n) {
  const red = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
  if (n === 0) return 'green'
  return red.has(n) ? 'red' : 'black'
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function formatMoney(n) {
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n)}`
}

function makeWavDataUri({ freq = 440, durationMs = 250, type = 'sine', sweep = null, volume = 0.25, sampleRate = 44100 }) {
  const durationS = durationMs / 1000
  const n = Math.max(1, Math.floor(sampleRate * durationS))

  const numChannels = 1
  const bitsPerSample = 16
  const blockAlign = (numChannels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = n * blockAlign

  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  let offset = 0
  function writeString(s) {
    for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i))
  }

  function writeUint32(v) {
    view.setUint32(offset, v, true)
    offset += 4
  }

  function writeUint16(v) {
    view.setUint16(offset, v, true)
    offset += 2
  }

  // RIFF header
  writeString('RIFF')
  writeUint32(36 + dataSize)
  writeString('WAVE')

  // fmt chunk
  writeString('fmt ')
  writeUint32(16) // PCM
  writeUint16(1) // AudioFormat PCM
  writeUint16(numChannels)
  writeUint32(sampleRate)
  writeUint32(byteRate)
  writeUint16(blockAlign)
  writeUint16(bitsPerSample)

  // data chunk
  writeString('data')
  writeUint32(dataSize)

  const amp = volume
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    let f = freq
    if (sweep) {
      // linear sweep: [f0..f1]
      const [f0, f1] = sweep
      f = f0 + (f1 - f0) * (t / durationS)
    }

    const phase = TWO_PI * f * t
    let sample = 0
    if (type === 'square') sample = Math.sign(Math.sin(phase))
    else if (type === 'triangle') sample = 2 / Math.PI * Math.asin(Math.sin(phase))
    else sample = Math.sin(phase)

    const s16 = Math.floor(clamp(sample * amp, -1, 1) * 32767)
    view.setInt16(offset, s16, true)
    offset += 2
  }

  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const base64 = btoa(binary)
  return `data:audio/wav;base64,${base64}`
}

let sounds = null

function initSounds() {
  try {
    // Спин: короткий нисходящий “шумовой” тон (по сути sweep)
    const spinSrc = makeWavDataUri({ freq: 880, durationMs: 240, type: 'triangle', sweep: [880, 180], volume: 0.14 })
    const winSrc = makeWavDataUri({ freq: 520, durationMs: 260, type: 'sine', sweep: [520, 920], volume: 0.22 })
    const loseSrc = makeWavDataUri({ freq: 420, durationMs: 260, type: 'sine', sweep: [420, 170], volume: 0.22 })

    sounds = {
      spin: new Howl({ src: [spinSrc], volume: 0.9 }),
      win: new Howl({ src: [winSrc], volume: 1.0 }),
      lose: new Howl({ src: [loseSrc], volume: 1.0 }),
    }
  } catch {
    sounds = null
  }
}

const els = {
  walletValue: document.getElementById('walletValue'),
  wheelCanvas: document.getElementById('wheelCanvas'),
  lastResult: document.getElementById('lastResult'),
  lastMeta: document.getElementById('lastMeta'),
  historyList: document.getElementById('historyList'),
  statusText: document.getElementById('statusText'),
  betStake: document.getElementById('betStake'),
  betNumber: document.getElementById('betNumber'),
  btnSpin: document.getElementById('btnSpin'),
  btnReset: document.getElementById('btnReset'),
}

const canvas = els.wheelCanvas
const ctx = canvas.getContext('2d')
let dpr = window.devicePixelRatio || 1

function fitCanvasToDpr() {
  dpr = window.devicePixelRatio || 1
  const cssW = canvas.clientWidth || 720
  const cssH = canvas.clientHeight || 720
  const w = Math.round(cssW * dpr)
  const h = Math.round(cssH * dpr)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
}

function resizeAndRedraw() {
  fitCanvasToDpr()
  drawWheel(rotation)
}

let rotation = 0
let animToken = 0
let wheelFlashUntil = 0
let wheelFlashColor = 'rgba(124,247,255,0.85)'
let wheelFlashDurationMs = 0
let hoveredIndex = -1

const sectorAngle = TWO_PI / rouletteOrder.length

function drawWheel(rot) {
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  const cx = w / 2
  const cy = h / 2
  const R = Math.min(cx, cy) * 0.86
  const innerR = R * 0.74

  // Легкий фон
  ctx.save()
  ctx.translate(cx, cy)

  const grad = ctx.createRadialGradient(0, 0, innerR * 0.2, 0, 0, R)
  grad.addColorStop(0, 'rgba(124, 247, 255, 0.20)')
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, TWO_PI)
  ctx.fill()
  ctx.restore()

  // Секторы колеса
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)

  const pointerAngle = -Math.PI / 2

  for (let i = 0; i < rouletteOrder.length; i++) {
    const number = rouletteOrder[i]
    const color = getRouletteColor(number)
    const start = pointerAngle + i * sectorAngle
    const end = start + sectorAngle

    let fill = 'rgba(255,255,255,0.08)'
    if (color === 'red') fill = '#ff4d6d'
    if (color === 'black') fill = '#1a1a1a'
    if (color === 'green') fill = '#29d27d'

    // Сектор
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, R, start, end)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()

    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.lineWidth = Math.max(1, 1.3 * dpr)
    ctx.stroke()

    // Текст
    const mid = (start + end) / 2
    const tx = Math.cos(mid) * (innerR)
    const ty = Math.sin(mid) * (innerR)
    ctx.save()
    ctx.translate(tx, ty)
    ctx.rotate(mid + Math.PI / 2)
    ctx.fillStyle = color === 'green' ? '#0b1023' : '#f7fbff'
    ctx.font = `${Math.round(14 * dpr)}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(number), 0, 0)
    ctx.restore()
  }

  // Внутренний обод
  ctx.beginPath()
  ctx.arc(0, 0, innerR, 0, TWO_PI)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fill()

  ctx.strokeStyle = 'rgba(124, 247, 255, 0.35)'
  ctx.lineWidth = Math.max(2, 2.2 * dpr)
  ctx.stroke()

  // Центр
  ctx.beginPath()
  ctx.arc(0, 0, innerR * 0.20, 0, TWO_PI)
  ctx.fillStyle = 'rgba(124,247,255,0.20)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, 0, innerR * 0.10, 0, TWO_PI)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fill()

  ctx.restore()

  // clean mode: no flash

  // Фиксированный указатель
  ctx.save()
  ctx.translate(cx, cy)

  ctx.beginPath()
  ctx.moveTo(0, -R - 10 * dpr)
  ctx.lineTo(-14 * dpr, -R + 22 * dpr)
  ctx.lineTo(14 * dpr, -R + 22 * dpr)
  ctx.closePath()
    ctx.fillStyle = '#cbd5e1'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(0, 0, innerR * 0.22, 0, TWO_PI)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fill()
  ctx.restore()
}

function spinToNumber(targetNumber) {
  const idx = rouletteOrder.indexOf(targetNumber)
  if (idx < 0) return Promise.resolve()

  const rotationBase = -idx * sectorAngle
  const twoPi = TWO_PI
  let targetRotation = rotationBase
  while (targetRotation <= rotation) targetRotation += twoPi

  animToken += 1
  const token = animToken

  return new Promise((resolve) => {
    // Физика: скорость затухает трением, но остановка жестко “прибивается” к target.
    let omega = 12 + Math.random() * 8 // ~1.5-2s spin
    let last = performance.now()
    const startedAt = last

    function frame(now) {
      if (token !== animToken) return
      const dt = Math.min(0.04, (now - last) / 1000)
      last = now

      // Плавное трение
      const decay = Math.pow(0.96, dt * 60)
      omega *= decay
      rotation += omega * dt

      const elapsed = now - startedAt
      if (((rotation >= targetRotation || omega < 0.28) && elapsed >= 1500) || elapsed >= 2000) {
        rotation = targetRotation
        drawWheel(rotation)
        resolve()
        return
      }

      drawWheel(rotation)
      requestAnimationFrame(frame)
    }

    requestAnimationFrame(frame)
  })
}

function updateHoveredSector(clientX, clientY) {
  const rect = canvas.getBoundingClientRect()
  const x = (clientX - rect.left) * dpr
  const y = (clientY - rect.top) * dpr
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  const dx = x - cx
  const dy = y - cy
  const dist = Math.hypot(dx, dy)
  const R = Math.min(cx, cy) * 0.86
  if (dist > R || dist < R * 0.2) {
    hoveredIndex = -1
    drawWheel(rotation)
    return
  }

  const pointerAngle = -Math.PI / 2
  const angle = Math.atan2(dy, dx)
  let local = angle - rotation - pointerAngle
  while (local < 0) local += TWO_PI
  while (local >= TWO_PI) local -= TWO_PI
  hoveredIndex = -1
  drawWheel(rotation)
}

function currentBetType() {
  const checked = document.querySelector('input[name="betType"]:checked')
  return checked ? checked.value : 'red'
}

function updateNumberVisibility() {
  const betType = currentBetType()
  const wrap = document.querySelector('.bet-row-number')
  if (!wrap) return
  const show = betType === 'number'
  wrap.style.display = show ? 'block' : 'none'
}

function renderHistory(history) {
  els.historyList.innerHTML = ''

  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]
    const item = document.createElement('div')
    item.className = 'hist-item'

    const left = document.createElement('div')
    left.className = 'hist-left'

    const dot = document.createElement('div')
    dot.className = `dot ${h.color || 'black'}`

    const txt = document.createElement('div')
    const label = document.createElement('div')
    label.className = 'hist-result'
    label.textContent = `${h.resultNumber}`
    const sub = document.createElement('div')
    sub.style.opacity = '0.75'
    sub.style.fontSize = '12px'
    sub.textContent = h.win ? 'WIN' : 'LOSE'

    txt.appendChild(label)
    txt.appendChild(sub)
    left.appendChild(dot)
    left.appendChild(txt)

    const right = document.createElement('div')
    right.className = 'hist-right'
    right.innerHTML = `${h.betType}<br/>${h.win ? '+' : ''}${h.payout || 0}`

    item.appendChild(left)
    item.appendChild(right)

    els.historyList.appendChild(item)
  }
}

async function refreshState() {
  els.statusText.textContent = 'Загрузка…'
  const state = await window.api?.casinoGetState?.()
  els.walletValue.textContent = formatMoney(state?.wallet)
  renderHistory(state?.history || [])
  els.statusText.textContent = 'Готово'
}

function setStatus(msg) {
  els.statusText.textContent = msg
}

async function handleSpin() {
  if (els.btnSpin.disabled) return

  const betType = currentBetType()
  const stake = Number(els.betStake.value)
  const number = Number(els.betNumber.value)

  const payload = { betType, stake, number }

  els.btnSpin.disabled = true
  setStatus('Крутится…')

  try {
    if (sounds?.spin) {
      try { sounds.spin.play() } catch {}
    }

    const resp = await window.api?.casinoSpin?.(payload)
    if (!resp?.ok) {
      const msg = resp?.error || 'Ошибка'
      setStatus(`Ошибка: ${msg}`)
      return
    }

    const targetNumber = resp.resultNumber
    renderHistory(resp.history || [])
    els.walletValue.textContent = formatMoney(resp.wallet)

    const color = resp.color || getRouletteColor(targetNumber)
    els.lastResult.textContent = `${targetNumber}`
    els.lastResult.style.color = color === 'red' ? '#ff4d6d' : color === 'black' ? '#ffffff' : '#29d27d'

    const meta = resp.win ? `Победа! Выплата: +${resp.payout}` : `Проигрыш.`
    els.lastMeta.textContent = meta

    await spinToNumber(targetNumber)

    drawWheel(rotation)

    if (resp.win) sounds?.win?.play?.()
    else sounds?.lose?.play?.()

    setStatus('Готово')
  } catch (err) {
    setStatus(`Ошибка: ${err?.message || String(err)}`)
  } finally {
    els.btnSpin.disabled = false
  }
}

function bindUI() {
  updateNumberVisibility()
  document.querySelectorAll('input[name="betType"]').forEach((r) => {
    r.addEventListener('change', () => updateNumberVisibility())
  })

  els.btnSpin.addEventListener('click', handleSpin)
  els.btnReset.addEventListener('click', async () => {
    const ok = confirm('Сбросить баланс и историю?')
    if (!ok) return
    try {
      await window.api?.casinoReset?.()
      rotation = 0
      drawWheel(rotation)
      await refreshState()
      els.lastResult.textContent = '—'
      els.lastMeta.textContent = ''
    } catch (err) {
      setStatus(`Ошибка: ${err?.message || String(err)}`)
    }
  })

  window.addEventListener('resize', () => resizeAndRedraw())
  canvas.addEventListener('mousemove', (e) => updateHoveredSector(e.clientX, e.clientY))
  canvas.addEventListener('mouseleave', () => {
    hoveredIndex = -1
    drawWheel(rotation)
  })
}

async function init() {
  initSounds()
  fitCanvasToDpr()
  drawWheel(rotation)
  bindUI()
  await refreshState()
}

init()

