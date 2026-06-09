import { useEffect, useState } from 'react';

type WeatherData = {
  city: string;
  temp: number;
  feels: number;
  humidity: number;
  wind_kmh: number;
  precip_mm: number;
  desc: string;
  icon: string;
  accent_hex: string;
  hourly: { time: string; temp: number; icon: string }[];
};

const WMO: Record<number, [string, string, string]> = {
  0: ['Ясно', '☀', '#f9e2af'],
  1: ['Преимущественно ясно', '🌤', '#f9e2af'],
  2: ['Переменная облачность', '⛅', '#bac2de'],
  3: ['Пасмурно', '☁', '#bac2de'],
  45: ['Туман', '🌫', '#84afdb'],
  61: ['Дождь', '🌧', '#74c7ec'],
  71: ['Снег', '❄', '#cdd6f4'],
  95: ['Гроза', '⛈', '#f9e2af'],
};

function wmo(code: number): [string, string, string] {
  return WMO[code] ?? ['Облачно', '☁', '#bac2de'];
}

async function fetchWeather(city = 'Москва'): Promise<WeatherData | null> {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru`
    );
    const geo = await geoRes.json();
    const hit = geo.results?.[0];
    if (!hit) return null;
    const { latitude, longitude, name, admin1 } = hit;
    const label = admin1 ? `${name}, ${admin1}` : name;

    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m' +
        '&hourly=temperature_2m,weather_code&timezone=auto&forecast_days=1'
    );
    const wx = await wxRes.json();
    const cur = wx.current ?? {};
    const code = cur.weather_code ?? 3;
    const [desc, icon, accent] = wmo(code);

    const times: string[] = wx.hourly?.time ?? [];
    const temps: number[] = wx.hourly?.temperature_2m ?? [];
    const codes: number[] = wx.hourly?.weather_code ?? [];
    const hourly = times.slice(0, 6).map((t, i) => {
      const [, ic] = wmo(codes[i] ?? code);
      return { time: t.slice(11, 16), temp: Math.round(temps[i] ?? 0), icon: ic };
    });

    return {
      city: label,
      temp: Math.round(cur.temperature_2m ?? 0),
      feels: Math.round(cur.apparent_temperature ?? 0),
      humidity: cur.relative_humidity_2m ?? 0,
      wind_kmh: Math.round(cur.wind_speed_10m ?? 0),
      precip_mm: cur.precipitation ?? 0,
      desc,
      icon,
      accent_hex: accent,
      hourly,
    };
  } catch {
    return null;
  }
}

export function WeatherCard({ city = 'Москва' }: { city?: string }) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      const w = await fetchWeather(city);
      if (alive) {
        setData(w);
        setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [city]);

  const accent = data?.accent_hex ?? '#74c7ec';

  return (
    <div className="glass-card weather-card" style={{ '--wx-accent': accent } as React.CSSProperties}>
      <div className="glass-ambient" style={{ background: accent }} />
      <div className="glass-hd">
        <div className="glass-title">ПОГОДА</div>
        <div className="glass-badge">OPEN-METEO</div>
      </div>
      {loading && !data ? (
        <div className="glass-muted">Загрузка…</div>
      ) : data ? (
        <>
          <div className="weather-hero">
            <span className="weather-icon-bg">{data.icon}</span>
            <div className="weather-temp" style={{ color: accent }}>{data.temp}°</div>
            <div className="weather-city">{data.city}</div>
            <div className="weather-desc" style={{ color: accent }}>{data.desc}</div>
          </div>
          <div className="weather-gauges">
            {[
              ['ВЕТЕР', `${data.wind_kmh} км/ч`],
              ['ВЛАЖН', `${data.humidity}%`],
              ['ОСАДК', `${data.precip_mm} мм`],
              ['ОЩУЩ', `${data.feels}°`],
            ].map(([k, v]) => (
              <div className="weather-gauge" key={k}>
                <div className="weather-gauge-k">{k}</div>
                <div className="weather-gauge-v" style={{ color: accent }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="weather-hourly">
            {data.hourly.map((h) => (
              <div className="weather-hour" key={h.time}>
                <div>{h.icon}</div>
                <div className="weather-hour-t">{h.temp}°</div>
                <div className="weather-hour-time">{h.time}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="glass-muted">Нет данных</div>
      )}
    </div>
  );
}
