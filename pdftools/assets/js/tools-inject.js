/* --------------------------------------------------------------
   tools-inject.js – уніфікована генерація списку PDF‑інструментів
   (версія з SVG‑іконками)
   -------------------------------------------------------------- */

(() => {
    /* ==================== 1️⃣ ДАНІ ==================== */

    // 1.1. Масив інструментів.
    //  – href  – шлях до каталогу інструмента (без .html і без початкового "/")
    //  – icon  – ID символу в sprite‑файлі `icons.svg`
    //  – title – назва, що показується користувачеві
    //  – desc  – короткий опис
    const tools = [
        {
            href:  'pdftools/pdfmerge',
            icon:  'merge-pdf-ico',
            title: 'Об’єднати PDF',
            desc:  'З’єднати кілька документів в один'
        },
        {
            href:  'pdftools/pdfsplit',
            icon:  'split-pdf-ico',
            title: 'Розділити PDF',
            desc:  'Розбий PDF на окремі сторінки'
        },
        {
            href:  'pdftools/pdfcompress',
            icon:  'compress-pdf-outline-ico',
            title: 'Стиснути PDF',
            desc:  'Зменшити розмір PDF‑файлу'
        },
        {
            href:  'pdftools/convert-pdf-to-image',
            icon:  'pdf-to-img-ico',
            title: 'PDF → Зображення',
            desc:  'Конвертувати PDF у PNG/JPG'
        },
        {
            href:  'pdftools/convert-image-to-pdf',
            icon:  'img-to-pdf-ico',
            title: 'Зображення → PDF',
            desc:  'Створити PDF з JPG/PNG/WebP'
        }
    ];

    // 1.2. Жорсткі виключення (наприклад, старі статичні сторінки)
    const MANUAL_EXCLUDED = [
        // '/pdf/merge.html',
        // '/some/old/page.html'
    ];

    // 1.3. Селектор контейнера‑placeholder
    const CONTAINER_SELECTOR = '#toolsInject';


    /* ==================== 2️⃣ УТИЛІТИ ==================== */

    /**
     * Нормалізує шлях:
     *   – додає початковий "/"
     *   – видаляє "/index.html"
     *   – прибирає зайві кінцеві "/"
     *   – переводить у нижній регістр
     */
    function normalizePath(raw) {
        let p = raw.startsWith('/') ? raw : '/' + raw;
        p = p.replace(/\/index\.html$/i, '');
        p = p.replace(/\/+$/g, '');
        return p.toLowerCase();
    }

    /** Чи є поточна сторінка однією з інструментів? */
    function isCurrentToolPage() {
        const cur = normalizePath(location.pathname);
        // 1) ручні виключення
        if (MANUAL_EXCLUDED.some(p => normalizePath(p) === cur)) return true;
        // 2) порівнюємо з масивом tools
        return tools.some(t => normalizePath(t.href) === cur);
    }

    /** HTML‑шаблон однієї картки (SVG‑іконка, назва, опис) */
    function renderCard(item) {
        const href = item.href;                 // залишаємо relative‑path – браузер підвантажить index.html
        return `
            <a href="${href}" data-link="${href}" class="tool-card">
                <svg class="icon" aria-hidden="true">
                    <use data-icon="assets/img/icons/icons.svg#${item.icon}"></use>
                </svg>
                <h3>${item.title}</h3>
                <p>${item.desc}</p>
            </a>
        `;
    }

    /* ==================== 3️⃣ Основна функція ==================== */

    function injectTools() {
        const container = document.querySelector(CONTAINER_SELECTOR);
        if (!container) {
            console.warn('[tools‑inject] Не знайдено контейнер:', CONTAINER_SELECTOR);
            return;
        }

        const curIsTool = isCurrentToolPage();               // чи на сторінці‑інструменті?
        const curPath   = normalizePath(location.pathname);   // нормалізований поточний шлях

        // Фільтруємо → коли ми вже на конкретному інструменті, то не виводимо посилання на нього
        const itemsHTML = tools
            .filter(item => {
                if (!curIsTool) return true;                 // на головній – залишаємо все
                return normalizePath(item.href) !== curPath;// на інструменті – виключаємо його
            })
            .map(renderCard)
            .join('');

        if (!itemsHTML) return; // нічого не залишилось – не вставляємо порожньої розмітки

        // Визначаємо, куди саме вставляємо (apps‑section → apps‑grid, інше → tools‑grid)
        const wrapperClass = container.closest('.apps-section')
            ? 'apps-grid'
            : 'tools-grid';

        container.innerHTML = `
            <div class="${wrapperClass}">
                ${itemsHTML}
            </div>
        `;
    }

    /* ==================== 4️⃣ Запуск після DOMReady ==================== */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectTools);
    } else {
        injectTools();
    }
})();
