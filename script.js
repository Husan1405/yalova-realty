// === Определение мобильного устройства ===
const IS_MOBILE = window.matchMedia('(max-width: 768px)').matches;
const IS_COARSE = window.matchMedia('(pointer: coarse)').matches;
const PREFERS_REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// === Прелоадер ===
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    setTimeout(() => preloader.classList.add('is-hidden'), IS_MOBILE ? 300 : 600);
});

// === Шапка: эффект при скролле (троттлинг через rAF) ===
const header = document.getElementById('header');
const scrollProgress = document.getElementById('scrollProgress');
let scrollTicking = false;

function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y > 30) header.classList.add('is-scrolled');
        else header.classList.remove('is-scrolled');

        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (y / docHeight) * 100 : 0;
        scrollProgress.style.width = progress + '%';
        scrollTicking = false;
    });
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// === Бургер ===
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
burger.addEventListener('click', () => {
    burger.classList.toggle('is-open');
    nav.classList.toggle('is-open');
});
nav.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => {
        burger.classList.remove('is-open');
        nav.classList.remove('is-open');
    });
});

// === Анимации появления (Intersection Observer) ===
const animatedItems = document.querySelectorAll('.fade-in, .fade-up, .reveal, .hero__line');

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

animatedItems.forEach(el => observer.observe(el));

// === Анимация счётчиков ===
const counters = document.querySelectorAll('.stat__num');
const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            const target = parseInt(el.dataset.count, 10);
            const duration = 1800;
            const start = performance.now();

            function tick(now) {
                const t = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - t, 3);
                el.textContent = Math.floor(eased * target);
                if (t < 1) requestAnimationFrame(tick);
                else el.textContent = target;
            }
            requestAnimationFrame(tick);
            counterObserver.unobserve(el);
        }
    });
}, { threshold: 0.5 });

counters.forEach(el => counterObserver.observe(el));

// === Частицы в hero (только десктоп, не на мобильных) ===
const particlesContainer = document.getElementById('particles');
if (particlesContainer && !IS_MOBILE && !PREFERS_REDUCED) {
    const count = 24;
    const colors = ['#2d4a3e', '#8a8a85', '#d8d4cb'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const p = document.createElement('span');
        p.className = 'particle';
        const size = Math.random() * 4 + 2;
        p.style.cssText = `
            width:${size}px;height:${size}px;
            left:${Math.random() * 100}%;
            animation-duration:${Math.random() * 12 + 10}s;
            animation-delay:${Math.random() * 8}s;
            opacity:${Math.random() * 0.4 + 0.2};
            background:${colors[Math.floor(Math.random() * colors.length)]};
        `;
        frag.appendChild(p);
    }
    particlesContainer.appendChild(frag);
}

// === Параллакс в hero (только на десктопе с тонким курсором) ===
const heroLayers = document.querySelectorAll('.hero__layer');
if (window.innerWidth > 1024 && !IS_COARSE && heroLayers.length) {
    let parallaxTicking = false;
    let lastX = 0, lastY = 0;
    document.addEventListener('mousemove', (e) => {
        lastX = (e.clientX / window.innerWidth - 0.5) * 2;
        lastY = (e.clientY / window.innerHeight - 0.5) * 2;
        if (parallaxTicking) return;
        parallaxTicking = true;
        requestAnimationFrame(() => {
            heroLayers.forEach((layer, i) => {
                const factor = (i + 1) * 12;
                layer.style.transform = `translate(${lastX * factor}px, ${lastY * factor}px)`;
            });
            parallaxTicking = false;
        });
    });
}

// === Плавная навигация со смещением под фикс. шапку ===
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId.length > 1) {
            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                const headerH = document.getElementById('header').offsetHeight;
                const top = target.getBoundingClientRect().top + window.scrollY - headerH + 1;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        }
    });
});

// === Лайтбокс: клик по фото открывает увеличенную версию ===
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxClose = document.getElementById('lightboxClose');

function extractBgUrl(el) {
    const bg = getComputedStyle(el).backgroundImage;
    const m = bg.match(/url\((['"]?)(.*?)\1\)/);
    return m ? m[2] : null;
}

function openLightbox(src, caption) {
    if (!src) return;
    lightboxImg.src = src;
    lightboxImg.alt = caption || '';
    lightboxCaption.textContent = caption || '';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
}

function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
}

// карточки мест
document.querySelectorAll('.place').forEach(place => {
    const img = place.querySelector('.place__image');
    const title = place.querySelector('h3')?.textContent.trim();
    if (!img) return;
    img.addEventListener('click', () => openLightbox(extractBgUrl(img), title));
});

// карточки в стопке "Море/Природа/Город"
document.querySelectorAll('.card-photo').forEach(card => {
    const inner = card.querySelector('.card-photo__inner');
    const tag = card.querySelector('.card-photo__tag')?.textContent.trim();
    if (!inner) return;
    inner.addEventListener('click', () => openLightbox(extractBgUrl(inner), tag));
});

// закрытие
lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.classList.contains('lightbox__inner')) {
        closeLightbox();
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('is-open')) closeLightbox();
});

// === Виджет погоды (Open-Meteo, без API-ключа) ===
(() => {
    const widget = document.getElementById('weather');
    if (!widget) return;

    const elTemp = document.getElementById('weatherTemp');
    const elDesc = document.getElementById('weatherDesc');
    const elIcon = document.getElementById('weatherIcon');
    const elFeels = document.getElementById('weatherFeels');
    const elHumidity = document.getElementById('weatherHumidity');
    const elWind = document.getElementById('weatherWind');
    const elStatus = document.getElementById('weatherStatus');
    const elHours = document.getElementById('weatherHours');
    const elDays = document.getElementById('weatherDays');

    // Координаты Яловы
    const LAT = 40.6549;
    const LON = 29.2842;
    const URL =
        'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${LAT}&longitude=${LON}` +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
        '&hourly=temperature_2m,weather_code,precipitation_probability' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
        '&forecast_days=10&past_days=0' +
        '&wind_speed_unit=ms&timezone=Europe%2FIstanbul';

    const CODE_MAP = {
        0:  { l: 'Ясно',                     i: 'sun' },
        1:  { l: 'Преимущественно ясно',     i: 'sun-cloud' },
        2:  { l: 'Переменная облачность',    i: 'sun-cloud' },
        3:  { l: 'Пасмурно',                 i: 'cloud' },
        45: { l: 'Туман',                    i: 'fog' },
        48: { l: 'Изморозь',                 i: 'fog' },
        51: { l: 'Лёгкая морось',            i: 'rain' },
        53: { l: 'Морось',                   i: 'rain' },
        55: { l: 'Сильная морось',           i: 'rain' },
        56: { l: 'Ледяная морось',           i: 'rain' },
        57: { l: 'Сильная ледяная морось',   i: 'rain' },
        61: { l: 'Небольшой дождь',          i: 'rain' },
        63: { l: 'Дождь',                    i: 'rain' },
        65: { l: 'Сильный дождь',            i: 'rain' },
        66: { l: 'Ледяной дождь',            i: 'rain' },
        67: { l: 'Сильный ледяной дождь',    i: 'rain' },
        71: { l: 'Небольшой снег',           i: 'snow' },
        73: { l: 'Снег',                     i: 'snow' },
        75: { l: 'Сильный снег',             i: 'snow' },
        77: { l: 'Снежная крупа',            i: 'snow' },
        80: { l: 'Ливень',                   i: 'rain' },
        81: { l: 'Сильный ливень',           i: 'rain' },
        82: { l: 'Очень сильный ливень',     i: 'rain' },
        85: { l: 'Снегопад',                 i: 'snow' },
        86: { l: 'Сильный снегопад',         i: 'snow' },
        95: { l: 'Гроза',                    i: 'thunder' },
        96: { l: 'Гроза с градом',           i: 'thunder' },
        99: { l: 'Сильная гроза с градом',   i: 'thunder' },
    };

    const ICONS = {
        sun: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                <g class="sun-core">
                    <circle cx="32" cy="32" r="11" fill="currentColor" fill-opacity="0.18"/>
                    <circle cx="32" cy="32" r="11"/>
                    <path d="M32 8v6M32 50v6M8 32h6M50 32h6M14.9 14.9l4.2 4.2M44.9 44.9l4.2 4.2M14.9 49.1l4.2-4.2M44.9 19.1l4.2-4.2"/>
                </g>
              </svg>`,
        'sun-cloud': `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <g class="sun-core">
                    <circle cx="22" cy="22" r="7" fill="currentColor" fill-opacity="0.18"/>
                    <circle cx="22" cy="22" r="7"/>
                    <path d="M22 8v4M22 32v4M8 22h4M32 22h4M12 12l2.8 2.8M29.2 29.2L32 32M12 32l2.8-2.8M29.2 14.8L32 12"/>
                </g>
                <path class="cloud-shape" d="M20 44a8 8 0 0 1 7.6-8 10 10 0 0 1 19.2 2A6 6 0 0 1 48 50H22a6 6 0 0 1-2-6z" fill="#fff" fill-opacity="0.65"/>
              </svg>`,
        cloud: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path class="cloud-shape" d="M14 42a10 10 0 0 1 9.6-10 12 12 0 0 1 23 2.6A8 8 0 0 1 46 50H18a8 8 0 0 1-4-8z" fill="currentColor" fill-opacity="0.16"/>
              </svg>`,
        fog: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path class="cloud-shape" d="M14 32a10 10 0 0 1 9.6-10 12 12 0 0 1 23 2.6A8 8 0 0 1 46 40H18a8 8 0 0 1-4-8z" fill="currentColor" fill-opacity="0.14"/>
                <path d="M10 48h44M14 56h36"/>
              </svg>`,
        rain: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path class="cloud-shape" d="M14 30a10 10 0 0 1 9.6-10 12 12 0 0 1 23 2.6A8 8 0 0 1 46 38H18a8 8 0 0 1-4-8z" fill="currentColor" fill-opacity="0.16"/>
                <line class="rain-drop" x1="22" y1="44" x2="20" y2="52"/>
                <line class="rain-drop" x1="32" y1="44" x2="30" y2="54"/>
                <line class="rain-drop" x1="42" y1="44" x2="40" y2="52"/>
              </svg>`,
        snow: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path class="cloud-shape" d="M14 30a10 10 0 0 1 9.6-10 12 12 0 0 1 23 2.6A8 8 0 0 1 46 38H18a8 8 0 0 1-4-8z" fill="currentColor" fill-opacity="0.16"/>
                <g stroke-width="2">
                    <g class="snow-flake" transform="translate(22 50)"><path d="M0-3v6M-3 0h6M-2-2l4 4M-2 2l4-4"/></g>
                    <g class="snow-flake" transform="translate(32 52)"><path d="M0-3v6M-3 0h6M-2-2l4 4M-2 2l4-4"/></g>
                    <g class="snow-flake" transform="translate(42 50)"><path d="M0-3v6M-3 0h6M-2-2l4 4M-2 2l4-4"/></g>
                </g>
              </svg>`,
        thunder: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path class="cloud-shape" d="M14 28a10 10 0 0 1 9.6-10 12 12 0 0 1 23 2.6A8 8 0 0 1 46 36H18a8 8 0 0 1-4-8z" fill="currentColor" fill-opacity="0.16"/>
                <path class="bolt" d="M30 38l-6 10h8l-4 8 10-12h-8l4-6z" fill="currentColor" fill-opacity="0.7"/>
              </svg>`,
    };

    function meta(code) { return CODE_MAP[code] || { l: 'Погода', i: 'cloud' }; }
    function iconHTML(code) { return ICONS[meta(code).i] || ICONS.cloud; }

    function fmtTemp(t) {
        if (t === null || t === undefined || Number.isNaN(t)) return '—';
        const v = Math.round(t);
        return (v > 0 ? '+' : '') + v;
    }
    function fmtTime(d) {
        return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    const DAY_NAMES_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

    function dayLabel(date, idx) {
        if (idx === 0) return 'Сегодня';
        if (idx === 1) return 'Завтра';
        return DAY_NAMES_FULL[date.getDay()];
    }
    function dateShort(date) {
        return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
    }
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    function renderHours(hourly) {
        if (!hourly || !hourly.time) { elHours.innerHTML = ''; return; }
        const now = new Date();
        const nowH = now.getHours();
        const todayKey = now.toDateString();

        // Найдём индекс ближайшего часа от текущего момента
        let startIdx = 0;
        for (let i = 0; i < hourly.time.length; i++) {
            const d = new Date(hourly.time[i]);
            if (d.toDateString() === todayKey && d.getHours() === nowH) { startIdx = i; break; }
            if (d > now) { startIdx = Math.max(0, i - 1); break; }
        }

        const COUNT = 24;
        const html = [];
        for (let i = 0; i < COUNT; i++) {
            const idx = startIdx + i;
            if (idx >= hourly.time.length) break;
            const d = new Date(hourly.time[idx]);
            const t = hourly.temperature_2m[idx];
            const code = hourly.weather_code[idx];
            const pop = hourly.precipitation_probability ? hourly.precipitation_probability[idx] : null;
            const isNow = i === 0;
            const label = isNow ? 'Сейчас' : `${String(d.getHours()).padStart(2, '0')}:00`;
            html.push(`
                <div class="weather-hour ${isNow ? 'weather-hour--now' : ''}" role="listitem"
                     title="${escapeHtml(meta(code).l)}">
                    <div class="weather-hour__time">${label}</div>
                    <div class="weather-hour__icon">${iconHTML(code)}</div>
                    <div class="weather-hour__temp">${fmtTemp(t)}°</div>
                    <div class="weather-hour__pop">${pop != null && pop >= 10 ? pop + '%' : ''}</div>
                </div>
            `);
        }
        elHours.innerHTML = html.join('');
    }

    function renderDays(daily) {
        if (!daily || !daily.time) { elDays.innerHTML = ''; return; }
        // Глобальный диапазон для шкалы
        let gMin = Infinity, gMax = -Infinity;
        for (let i = 0; i < daily.time.length; i++) {
            gMin = Math.min(gMin, daily.temperature_2m_min[i]);
            gMax = Math.max(gMax, daily.temperature_2m_max[i]);
        }
        const span = Math.max(1, gMax - gMin);

        const html = [];
        for (let i = 0; i < daily.time.length; i++) {
            const d = new Date(daily.time[i] + 'T00:00:00');
            const code = daily.weather_code[i];
            const tMin = daily.temperature_2m_min[i];
            const tMax = daily.temperature_2m_max[i];
            const pop = daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : null;

            const left = ((tMin - gMin) / span) * 100;
            const width = Math.max(10, ((tMax - tMin) / span) * 100);
            const isToday = i === 0;

            html.push(`
                <div class="weather-day ${isToday ? 'weather-day--today' : ''}" role="listitem" title="${escapeHtml(meta(code).l)}">
                    <div class="weather-day__name">
                        ${escapeHtml(dayLabel(d, i))}
                        <span>${escapeHtml(dateShort(d))}</span>
                    </div>
                    <div class="weather-day__icon">${iconHTML(code)}</div>
                    <div class="weather-day__range">
                        <span class="weather-day__max">${fmtTemp(tMax)}°</span>
                        <span class="weather-day__min">${fmtTemp(tMin)}°</span>
                    </div>
                    <div class="weather-day__bar"><span style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></span></div>
                    <div class="weather-day__pop">${pop != null && pop >= 10 ? pop + '%' : ''}</div>
                </div>
            `);
        }
        elDays.innerHTML = html.join('');
    }

    async function fetchWeather() {
        try {
            elStatus.textContent = 'Обновление…';
            widget.classList.remove('is-error');

            const res = await fetch(URL, { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const cur = data.current;
            if (!cur) throw new Error('No current data');

            const m = meta(cur.weather_code);

            const temp = fmtTemp(cur.temperature_2m);
            elTemp.textContent = temp;
            document.getElementById('triggerTemp').textContent = temp + '°';
            document.getElementById('triggerIcon').innerHTML = iconHTML(cur.weather_code).replace(/svg/g, 'svg style="width:20px;height:20px"');

            elDesc.textContent = m.l;
            elIcon.innerHTML = iconHTML(cur.weather_code);
            elFeels.textContent = fmtTemp(cur.apparent_temperature) + '°';
            elHumidity.textContent = Math.round(cur.relative_humidity_2m) + '%';
            elWind.textContent = cur.wind_speed_10m.toFixed(1).replace('.', ',') + ' м/с';
            elStatus.textContent = 'Обн. ' + fmtTime(new Date());

            renderHours(data.hourly);
            renderDays(data.daily);

            widget.classList.add('is-ready');
        } catch (err) {
            console.warn('Weather fetch failed:', err);
            widget.classList.add('is-ready', 'is-error');
            elStatus.textContent = 'Нет связи';
            if (!elTemp.textContent || elTemp.textContent === '—') {
                elDesc.textContent = 'Не удалось загрузить погоду';
                elIcon.innerHTML = ICONS.cloud;
            }
        }
    }

    // Управление модальным окном погоды
    const modal = document.getElementById('weatherModal');
    const trigger = document.getElementById('weatherTrigger');
    const modalClose = document.getElementById('weatherModalClose');

    trigger.addEventListener('click', () => {
        modal.classList.add('is-open');
    });

    modalClose.addEventListener('click', () => {
        modal.classList.remove('is-open');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('is-open');
    });

    // Колесо мыши → горизонтальный скролл лент
    function enableWheelScroll(el) {
        el.addEventListener('wheel', (e) => {
            // Если у пользователя нативный горизонтальный скролл (тачпад) — не мешаем
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            if (e.deltaY === 0) return;
            const max = el.scrollWidth - el.clientWidth;
            if (max <= 0) return;
            const next = el.scrollLeft + e.deltaY;
            // Если уже на краю и продолжаем туда же — пропускаем событие странице
            if ((e.deltaY > 0 && el.scrollLeft >= max) ||
                (e.deltaY < 0 && el.scrollLeft <= 0)) return;
            e.preventDefault();
            el.scrollLeft = Math.max(0, Math.min(max, next));
        }, { passive: false });
    }
    enableWheelScroll(elHours);
    enableWheelScroll(elDays);

    fetchWeather();
    // Автообновление каждые 15 минут
    let lastUpdate = Date.now();
    setInterval(() => { lastUpdate = Date.now(); fetchWeather(); }, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Date.now() - lastUpdate > 10 * 60 * 1000) {
            lastUpdate = Date.now();
            fetchWeather();
        }
    });
})();

// === Hover-эффект «магнит» на карточках (только десктоп, точный курсор) ===
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !IS_MOBILE) {
    document.querySelectorAll('.property, .place, .feature').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width - 0.5) * 6;
            const y = ((e.clientY - rect.top) / rect.height - 0.5) * 6;
            card.style.transform = `translateY(-8px) rotateX(${-y}deg) rotateY(${x}deg)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
}

/* ============================================================
 * Служба поддержки — отправка заявки в Telegram-бота
 * ------------------------------------------------------------
 * ВНИМАНИЕ: токен бота находится в исходниках страницы и виден
 * любому посетителю. Это допустимо только потому, что у сайта
 * нет бэкенда. Рекомендуется:
 *   1) Создать ОТДЕЛЬНОГО бота только для приёма заявок
 *      (не использовать его ни для чего другого).
 *   2) При утечке токена — отозвать его в @BotFather (/revoke)
 *      и заменить значение TELEGRAM_BOT_TOKEN ниже.
 *   3) В перспективе — поднять простой прокси (Cloudflare Worker
 *      / Google Apps Script) и хранить токен на сервере.
 *
 * Чтобы получить TELEGRAM_CHAT_ID (куда бот будет слать заявки):
 *   1) Откройте бота в Telegram, нажмите /start.
 *   2) В браузере откройте:
 *        https://api.telegram.org/bot<ТОКЕН>/getUpdates
 *   3) В JSON найдите "chat":{"id":<число>} — это ваш chat_id.
 *      Вставьте его в TELEGRAM_CHAT_ID ниже.
 * ============================================================ */
const TELEGRAM_BOT_TOKEN = '8765335031:AAET58A8KEt42gpwBUbNB780xBFh94piGjw';
const TELEGRAM_CHAT_ID = '766091630'; // личка @Khusan_2000

(function initSupport() {
    const btn = document.getElementById('supportBtn');
    const panel = document.getElementById('support');
    const closeBtn = document.getElementById('supportClose');
    const form = document.getElementById('supportForm');
    const submitBtn = document.getElementById('supportSubmit');
    const statusEl = document.getElementById('supportStatus');
    const nameInput = document.getElementById('supportName');
    const contactInput = document.getElementById('supportContact');
    const messageInput = document.getElementById('supportMessage');

    if (!btn || !panel || !form) return;

    let isOpen = false;
    let lastSentAt = 0; // антиспам на клиенте

    function setOpen(open) {
        isOpen = open;
        panel.classList.toggle('is-open', open);
        panel.setAttribute('aria-hidden', open ? 'false' : 'true');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.classList.toggle('is-active', open);
        if (open) {
            setTimeout(() => nameInput && nameInput.focus(), 250);
        }
    }

    btn.addEventListener('click', () => setOpen(!isOpen));
    closeBtn && closeBtn.addEventListener('click', () => setOpen(false));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) setOpen(false);
    });

    document.addEventListener('click', (e) => {
        if (!isOpen) return;
        if (panel.contains(e.target) || btn.contains(e.target)) return;
        setOpen(false);
    });

    function setStatus(text, kind) {
        statusEl.textContent = text || '';
        statusEl.classList.remove('is-success', 'is-error');
        if (kind === 'success') statusEl.classList.add('is-success');
        if (kind === 'error') statusEl.classList.add('is-error');
    }

    function setLoading(loading) {
        submitBtn.disabled = loading;
        submitBtn.classList.toggle('is-loading', loading);
    }

    function clearErrors() {
        [nameInput, contactInput, messageInput].forEach(el => el.classList.remove('is-error'));
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function buildMessage({ name, contact, message }) {
        const when = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Istanbul' });
        const page = window.location.href;
        return (
            '<b>Новая заявка с сайта «Турецкий рассвет»</b>\n\n' +
            '<b>Имя:</b> ' + escapeHtml(name) + '\n' +
            '<b>Контакт:</b> ' + escapeHtml(contact) + '\n\n' +
            '<b>Сообщение:</b>\n' + escapeHtml(message) + '\n\n' +
            '<i>' + escapeHtml(when) + ' (Стамбул) · ' + escapeHtml(page) + '</i>'
        );
    }

    async function sendToTelegram(text) {
        if (!TELEGRAM_CHAT_ID) {
            throw new Error('NO_CHAT_ID');
        }
        const url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
            throw new Error(data.description || 'HTTP ' + res.status);
        }
        return data;
    }

    // Автооткрытие — только на десктопе (на мобиле перекрывает hero и мешает)
    if (!IS_MOBILE) {
        window.addEventListener('load', () => {
            setTimeout(() => setOpen(true), 1000);
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();

        const name = nameInput.value.trim();
        const contact = contactInput.value.trim();
        const message = messageInput.value.trim();

        let invalid = false;
        if (name.length < 2) { nameInput.classList.add('is-error'); invalid = true; }
        if (contact.length < 4) { contactInput.classList.add('is-error'); invalid = true; }
        if (message.length < 5) { messageInput.classList.add('is-error'); invalid = true; }
        if (invalid) {
            setStatus('Заполните все поля корректно.', 'error');
            return;
        }

        const now = Date.now();
        if (now - lastSentAt < 15000) {
            setStatus('Подождите немного перед повторной отправкой.', 'error');
            return;
        }

        setLoading(true);
        setStatus('Отправляем сообщение…');

        try {
            await sendToTelegram(buildMessage({ name, contact, message }));
            lastSentAt = Date.now();
            form.reset();
            setStatus('Спасибо! Мы свяжемся с вами в ближайшее время.', 'success');
            setTimeout(() => {
                if (isOpen) setOpen(false);
                setStatus('');
            }, 3000);
        } catch (err) {
            console.error('[support] send failed:', err);
            if (err && err.message === 'NO_CHAT_ID') {
                setStatus('Виджет ещё не настроен администратором. Напишите нам в WhatsApp.', 'error');
            } else {
                setStatus('Не удалось отправить. Попробуйте позже или напишите в WhatsApp.', 'error');
            }
        } finally {
            setLoading(false);
        }
    });
})();

// === Каталог квартир === 
(function() {
    const gridContainer = document.getElementById('apartmentsGrid');
    const filterTypeSelect = document.getElementById('filterType');
    const filterStatusSelect = document.getElementById('filterStatus');
    const searchInput = document.getElementById('searchApartments');
    
    let apartments = [];

    // Загрузить квартиры из API
    function loadApartments() {
        fetch('https://https-nedvijimost-yalova.onrender.com/api/apartments')
            .then(response => response.json())
            .then(data => {
                apartments = data;
                renderApartments();
            })
            .catch(e => {
                console.error('Failed to load apartments:', e);
                apartments = [];
            });
    }
    // Сохранить квартиры в localStorage
    function saveApartments() {
        localStorage.setItem('apartments', JSON.stringify(apartments));
        renderApartments();
    }

    // Отобразить квартиры с фильтрацией
    function renderApartments() {
        const typeFilter = filterTypeSelect.value;
        const statusFilter = filterStatusSelect.value;
        const searchTerm = searchInput.value.toLowerCase();

        const filtered = apartments.filter(apt => {
            const matchesType = !typeFilter || apt.type === typeFilter;
            const matchesStatus = !statusFilter || apt.status === statusFilter;
            const matchesSearch = !searchTerm || 
                apt.title.toLowerCase().includes(searchTerm) ||
                apt.description.toLowerCase().includes(searchTerm);
            return matchesType && matchesStatus && matchesSearch;
        });

        if (filtered.length === 0) {
            gridContainer.innerHTML = `
                <div class="apartments__empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                        <path d="M3 21h18M3 10h18M5 5h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z"/>
                        <path d="M9 14v4M15 14v4"/>
                    </svg>
                    <p>По вашему запросу ничего не найдено.</p>
                    <span class="apartments__empty-hint">Попробуйте изменить фильтры</span>
                </div>
            `;
            return;
        }

        gridContainer.innerHTML = filtered.map(apt => `
            <article class="apartment-card reveal">
                <div class="apartment-card__image" ${apt.image ? `style="background-image: url('${apt.image}')"` : ''}>
                    ${!apt.image ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18M3 10h18M5 5h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z"/><path d="M9 14v4M15 14v4"/></svg>' : ''}
                </div>
                <div class="apartment-card__badge">
                    ${apt.status === 'sale' ? 'На продажу' : 'На аренду'}
                </div>
                <div class="apartment-card__content">
                    <div class="apartment-card__type">${apt.type === 'apartment' ? 'Квартира' : apt.type === 'villa' ? 'Вилла' : 'Участок'}</div>
                    <h3 class="apartment-card__title">${apt.title}</h3>
                    <p class="apartment-card__description">${apt.description}</p>
                    <div class="apartment-card__price">${apt.price}</div>
                    ${apt.rooms || apt.area ? `
                        <div class="apartment-card__details">
                            ${apt.rooms ? `
                                <div class="apartment-card__detail">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                    ${apt.rooms} комн.
                                </div>
                            ` : ''}
                            ${apt.area ? `
                                <div class="apartment-card__detail">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                                    ${apt.area} м²
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    <div class="apartment-card__actions">
                        <a href="#contacts" class="apartment-card__btn">Узнать подробнее</a>
                        <button class="apartment-card__btn" onclick="window.deleteApartment('${apt.id}')" style="background: #fde8e8; color: #c0392b; border-color: #c0392b;">Удалить</button>
                    </div>
                </div>
            </article>
        `).join('');

        // Переинициализировать анимации для новых элементов
        const newItems = document.querySelectorAll('.apartment-card');
        newItems.forEach(item => {
            observer.observe(item);
        });
    }

    // События фильтрации
    filterTypeSelect.addEventListener('change', renderApartments);
    filterStatusSelect.addEventListener('change', renderApartments);
    searchInput.addEventListener('input', renderApartments);

    // Загрузить при инициализации
    loadApartments();

    // Экспортировать функцию удаления в глобальное пространство
    window.deleteApartment = function(id) {
        if (confirm('Вы уверены, что хотите удалить эту квартиру?')) {
            apartments = apartments.filter(apt => apt.id !== id);
            saveApartments();
        }
    };

    // Экспортировать функцию добавления для использования ботом
    window.addApartment = function(apartmentData) {
        const newApt = {
            id: Date.now().toString(),
            ...apartmentData,
            timestamp: new Date().toISOString()
        };
        apartments.push(newApt);
        saveApartments();
        return newApt;
    };

    // Экспортировать функцию получения квартир
    window.getApartments = function() {
        return apartments;
    };
})();
