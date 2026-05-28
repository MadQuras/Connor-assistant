# Connor Assistant - Style Guide

## Цветовая палитра

### Основные цвета
```css
--bg-primary: #05050E;      /* Основной фон */
--bg-secondary: #0A0A14;    /* Вторичный фон */
--bg-tertiary: #0F0F1E;     /* Третичный фон */

--accent-primary: #00B4D8;  /* Основной акцент (синий) */
--accent-hover: #0096C7;    /* Hover состояние */
--accent-active: #0077B6;   /* Active состояние */

--text-primary: #FFFFFF;    /* Основной текст */
--text-secondary: #B0B0C8;  /* Вторичный текст */
--text-muted: #6E6E8C;      /* Приглушённый текст */

--border: #1E1E32;          /* Границы */
--shadow: rgba(0, 0, 0, 0.5); /* Тени */
```

### Дополнительные акценты
```css
--accent-blue: #3A86FF;     /* Ярко-синий */
--accent-green: #06D6A0;    /* Зелёный (успех) */
--accent-red: #FF4D6D;      /* Красный (ошибка) */
--accent-purple: #9B5DE5;   /* Фиолетовый */
--accent-yellow: #FFD60A;   /* Жёлтый (предупреждение) */
--accent-orange: #FB5607;   /* Оранжевый */
--accent-pink: #FF79C6;     /* Розовый */
```

## Типографика

### Шрифты
```css
--font-mono: 'Share Tech Mono', monospace;
--font-display: 'Rajdhani', sans-serif;
--font-body: 'Inter', sans-serif;
```

### Размеры
```css
--text-xs: 10px;
--text-sm: 12px;
--text-base: 14px;
--text-lg: 16px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 32px;
--text-4xl: 48px;
--text-5xl: 72px;
```

### Веса
```css
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

## Отступы и размеры

### Spacing
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### Border Radius
```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-2xl: 20px;
--radius-3xl: 24px;
--radius-full: 9999px;
```

## Компоненты

### Кнопки

#### Primary Button
```css
background: var(--accent-primary);
color: var(--text-primary);
padding: 12px 24px;
border-radius: var(--radius-3xl); /* Пилюля */
font-family: var(--font-display);
font-weight: var(--font-semibold);
font-size: var(--text-base);
transition: all 0.2s ease;

/* Hover */
background: var(--accent-hover);
transform: translateY(-2px);
box-shadow: 0 4px 12px rgba(0, 180, 216, 0.3);
```

#### Secondary Button
```css
background: transparent;
color: var(--accent-primary);
border: 2px solid var(--accent-primary);
padding: 12px 24px;
border-radius: var(--radius-3xl);
```

#### Ghost Button
```css
background: transparent;
color: var(--text-secondary);
padding: 12px 24px;
border-radius: var(--radius-3xl);

/* Hover */
background: rgba(255, 255, 255, 0.05);
```

### Карточки

#### Card
```css
background: var(--bg-secondary);
border: 1px solid var(--border);
border-radius: var(--radius-lg);
padding: var(--space-6);
box-shadow: 0 2px 8px var(--shadow);
```

#### Card Hover
```css
border-color: var(--accent-primary);
transform: translateY(-4px);
box-shadow: 0 8px 24px var(--shadow);
```

### Inputs

#### Text Input
```css
background: var(--bg-tertiary);
border: 1px solid var(--border);
border-radius: var(--radius-md);
padding: 12px 16px;
color: var(--text-primary);
font-family: var(--font-mono);
font-size: var(--text-base);

/* Focus */
border-color: var(--accent-primary);
box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.1);
```

#### Slider
```css
/* Track */
background: var(--bg-tertiary);
height: 4px;
border-radius: var(--radius-full);

/* Thumb */
background: var(--accent-primary);
width: 16px;
height: 16px;
border-radius: var(--radius-full);
box-shadow: 0 2px 4px var(--shadow);
```

### Overlay

#### Wave Overlay
```css
position: fixed;
top: 20px;
left: 50%;
transform: translateX(-50%);
width: 400px;
height: 80px;
background: transparent;
z-index: 9999;

/* Wave */
stroke: var(--accent-primary);
stroke-width: 3px;
fill: none;
```

#### Text Overlay
```css
position: fixed;
left: 0;
top: 0;
width: 260px;
height: 100vh;
background: rgba(4, 4, 12, 0.9);
backdrop-filter: blur(10px);
padding: var(--space-6);
z-index: 9998;

/* Text */
font-family: var(--font-mono);
font-size: var(--text-sm);
color: var(--text-primary);
line-height: 1.6;
```

## Анимации

### Transitions
```css
--transition-fast: 0.1s ease;
--transition-base: 0.2s ease;
--transition-slow: 0.3s ease;
```

### Keyframes

#### Fade In
```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### Slide In
```css
@keyframes slideIn {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}
```

#### Pulse
```css
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
```

#### Wave
```css
@keyframes wave {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(10px);
  }
}
```

## Иконки

### Стиль
- Line icons (не filled)
- Stroke width: 2px
- Size: 16px, 20px, 24px
- Color: наследуется от текста

### Библиотека
Lucide Icons - https://lucide.dev/

### Примеры
```html
<svg width="24" height="24" stroke="currentColor" fill="none">
  <!-- Icon path -->
</svg>
```

## Состояния

### Success
```css
color: var(--accent-green);
background: rgba(6, 214, 160, 0.1);
border-color: var(--accent-green);
```

### Error
```css
color: var(--accent-red);
background: rgba(255, 77, 109, 0.1);
border-color: var(--accent-red);
```

### Warning
```css
color: var(--accent-yellow);
background: rgba(255, 214, 10, 0.1);
border-color: var(--accent-yellow);
```

### Info
```css
color: var(--accent-blue);
background: rgba(58, 134, 255, 0.1);
border-color: var(--accent-blue);
```

## Layout

### Grid
```css
display: grid;
grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
gap: var(--space-6);
```

### Flex
```css
display: flex;
align-items: center;
justify-content: space-between;
gap: var(--space-4);
```

### Container
```css
max-width: 1200px;
margin: 0 auto;
padding: 0 var(--space-6);
```

## Примеры использования

### Welcome Screen
```html
<div class="welcome-screen">
  <div class="logo">
    <div class="logo-icon">RK800</div>
    <h1>CONNOR</h1>
  </div>
  <p class="subtitle">Голосовой ассистент</p>
  <button class="btn-primary">Начать настройку</button>
</div>
```

### Boot Screen
```html
<div class="boot-screen">
  <div class="boot-logo">
    <div class="spinner"></div>
    <div class="boot-text">ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ</div>
  </div>
  <div class="boot-progress">
    <div class="progress-bar"></div>
    <div class="progress-text">Загрузка модулей...</div>
  </div>
</div>
```

### Settings Panel
```html
<div class="settings-panel">
  <div class="setting-group">
    <label>Цвет волны</label>
    <div class="color-picker">
      <div class="color-option" data-color="#00B4D8"></div>
      <div class="color-option" data-color="#3A86FF"></div>
      <!-- ... -->
    </div>
  </div>
  
  <div class="setting-group">
    <label>Громкость</label>
    <input type="range" min="0" max="100" value="80">
  </div>
</div>
```

## Accessibility

### Контрастность
- Минимум 4.5:1 для обычного текста
- Минимум 3:1 для крупного текста
- Минимум 3:1 для UI элементов

### Focus States
```css
:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

### Screen Reader
```html
<button aria-label="Закрыть">
  <svg><!-- X icon --></svg>
</button>
```

---

**Версия:** 1.0.0  
**Дата:** Май 2026  
**Применение:** PyQt5 Overlay, Tauri UI, Web Components
