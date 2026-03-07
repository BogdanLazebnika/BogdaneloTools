/* --------------------------------------------------------------
   tools-inject.js – уніфікована генерація списку PDF‑інструментів
   -------------------------------------------------------------- */

(() => {
    // -----------------------------------------------------------------
    // 1️⃣  ДАНІ
    // -----------------------------------------------------------------

    // 1.1. Список інструментів (шлях – папка, без .html та без /)
    const tools = [
        {
            href: 'pdftools/pdfmerge',
            icon: '🔗',
            title: 'Об’єднати PDF',
            desc: 'З’єднати кілька документів в один'
        },
        {
            href: 'pdftools/pdfsplit',
            icon: '✂',
            title: 'Розділити PDF',
            desc: 'Розбий PDF на окремі сторінки'
        },
        {
            href: 'pdftools/pdfcompress',
            icon: '🗜',
            title: 'Стиснути PDF',
            desc: 'Зменшити розмір PDF файлу'
        },
        {
            href: 'pdftools/convert-pdf-to-image',
            icon: '📷',
            title: 'PDF → Зображення',
            desc: 'Конвертувати PDF у PNG/JPG'
        },
        {
            href: 'pdftools/convert-image-to-pdf',
            icon: '📷',
            title: 'Зображення → PDF',
            desc: 'Створити PDF з JPG/PNG/WebP'
        }
    ];

    // 1.2. Якщо потрібні “жорсткі” виключення (наприклад старі статичні сторінки)
    const MANUAL_EXCLUDED = [
        // '/pdf/merge.html',
        // '/some/old/page.html'
    ];

    // 1.3. Селектор контейнера‑placeholder
    const CONTAINER_SELECTOR = '#toolsInject';

    // -----------------------------------------------------------------
    // 2️⃣  УТИЛІТИ
    // -----------------------------------------------------------------

    /**
     * Очищає шлях:
     *   – гарантує, що він починається з «/»,
     *   – видаляє "/index.html",
     *   – викидає зайві кінцеві '/',
     *   – переводить у нижній регістр.
     */
    function normalizePath(raw) {
        let p = raw.startsWith('/') ? raw : '/' + raw;
        // видаляємо /index.html (може бути /index.html або /index.HTML)
        p = p.replace(/\/index\.html$/i, '');
        // прибираємо зайві слеші в кінці
        p = p.replace(/\/+$/g, '');
        return p.toLowerCase();
    }

    /** Чи поточна сторінка – це одна з наших папок‑інструментів? */
    function isCurrentToolPage() {
        const cur = normalizePath(location.pathname);
        // 1) ручні виключення
        if (MANUAL_EXCLUDED.some(p => normalizePath(p) === cur)) return true;
        // 2) порівнюємо з масивом tools
        return tools.some(t => normalizePath(t.href) === cur);
    }

    /** HTML‑шаблон однієї картки (для app‑grid або tools‑grid) */
    function renderCard(item) {
        // залишаємо relative папку – браузер завантажить index.html автоматично
        const href = item.href;
        return `
            <a href="${href}" data-link="${href}" class="tool-card">
                <span>${item.icon}</span>
                <h3>${item.title}</h3>
                <p>${item.desc}</p>
            </a>
        `;
    }

    // -----------------------------------------------------------------
    // 3️⃣  Основна функція – генеруємо та вставляємо блок
    // -----------------------------------------------------------------
    function injectTools() {
        const container = document.querySelector(CONTAINER_SELECTOR);
        if (!container) {
            console.warn('[tools‑inject] Не знайдено контейнер:', CONTAINER_SELECTOR);
            return;
        }

        const curIsTool = isCurrentToolPage();               // чи на сторінці‑інструменті?
        const curPath   = normalizePath(location.pathname);   // нормалізований поточний шлях

        // Фільтруємо: якщо ми на сторінці‑інструменті, то виключаємо саме це посилання.
        const itemsHTML = tools
            .filter(item => {
                if (!curIsTool) return true;                 // на головній – залишаємо все
                // на сторінці‑інструменті – відкидаємо лише те, що співпадає
                return normalizePath(item.href) !== curPath;
            })
            .map(renderCard)
            .join('');

        if (!itemsHTML) return; // нічого не залишилось – не вставляємо порожнє

        // Два варіанти розмітки – в залежності від того, куди будемо вставляти:
        //  * Якщо контейнер знаходиться в "apps-section" → клас apps-grid
        //  * Якщо в "other-tools" → клас tools-grid
        const wrapperClass = container.closest('.apps-section')
            ? 'apps-grid'
            : 'tools-grid';

        container.innerHTML = `
            <div class="${wrapperClass}">
                ${itemsHTML}
            </div>
        `;
    }

    // -----------------------------------------------------------------
    // 4️⃣  Запуск після повного парсінгу DOM
    // -----------------------------------------------------------------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectTools);
    } else {
        injectTools();
    }
})();
