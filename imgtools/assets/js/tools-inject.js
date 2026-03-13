/* --------------------------------------------------------------
   tools‑inject.js – динамічне формування списку Image Tools
   -------------------------------------------------------------- */

(() => {
    /* ==================== 1️⃣ ДАНІ ==================== */

    // 1.1. Масив інструментів (шлях без .html, без початкового "/")
    const tools = [
    {
        href: 'imgtools/optimizer-img',
        icon: 'optimization-img-ico',
        title: 'Оптимізатор зображень',
        desc: 'Стискайте JPEG, PNG, WebP, AVIF без втрати якості.'
    }
];

    // 1.2. Жорсткі виключення (якщо треба приховати окремі сторінки)
    const MANUAL_EXCLUDED = [
        // '/imagetools/old-page.html',
        // '/some/legacy/tool.html'
    ];

    // 1.3. Селектор контейнера‑placeholder
    const CONTAINER_SELECTOR = '#toolsInject';


    /* ==================== 2️⃣ УТИЛІТИ ==================== */

    /**
     * Нормалізує шлях:
     *  – додає початковий "/"
     *  – видаляє "/index.html"
     *  – прибирає зайві кінцеві "/"
     *  – переводить у нижній регістр
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

    /** HTML‑шаблон однієї картки */
    function renderCard(item) {
    const href = item.href;

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

        const curIsTool   = isCurrentToolPage();               // на сторінці‑інструменті чи ні
        const curPath    = normalizePath(location.pathname);   // нормалізований поточний шлях

        const itemsHTML = tools
            .filter(item => {
                // Якщо ми на одній зі сторінок інструменту – виключаємо саме її
                if (!curIsTool) return true;
                return normalizePath(item.href) !== curPath;
            })
            .map(renderCard)
            .join('');

        if (!itemsHTML) return; // нічого не залишилось (наприклад, на сторінці “convert” залишилося лише 5 інших інструментів)

        // Визначаємо, куди саме вставляємо: apps‑section → клас apps-grid,
        // інший випадок (наприклад sidebar) → tools‑grid
        const wrapperClass = container.closest('.apps-section')
            ? 'apps-grid'
            : 'tools-grid';

        container.innerHTML = `
            <div class="${wrapperClass}">
                ${itemsHTML}
            </div>
        `;
    }

    /* ==================== 4️⃣ Запуск ==================== */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectTools);
    } else {
        injectTools();
    }
})();
