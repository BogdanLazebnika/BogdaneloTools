// assets/js/main.js

export async function loadPartial(url, containerSelector) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to load ${url}`);

    const html = await resp.text();
    const container = document.querySelector(containerSelector);

    if (!container) return;

    // Вставляємо HTML
    container.innerHTML = html;

    // 🔥 Активуємо всі script теги вручну
    const scripts = container.querySelectorAll('script');

    scripts.forEach(oldScript => {
        const newScript = document.createElement('script');

        // Копіюємо атрибути
        [...oldScript.attributes].forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
        });

        newScript.textContent = oldScript.textContent;

        oldScript.replaceWith(newScript);
    });
}


/* АВТОЗАПУСК */
document.addEventListener('DOMContentLoaded', async () => {

    await loadPartial('partials/header.html', 'header');
    await loadPartial('partials/footer.html', 'footer');

    // 🔥 після вставки partial можемо ініціалізувати речі
    syncThemeButton();

});


/* СИНХРОНІЗАЦІЯ КНОПКИ ТЕМИ */
function syncThemeButton() {
    const themeBtn = document.getElementById('themeToggle');
    if (!themeBtn) return;

    const isLight = document.body.classList.contains('light-theme');
    themeBtn.textContent = isLight ? '☀️' : '🌙';
}

setTimeout(() => {
    const themeBtn = document.getElementById('themeToggle');
    if (!themeBtn) return;

    const isLight = document.body.classList.contains('light-theme');
    themeBtn.textContent = isLight ? '☀️' : '🌙';
}, 50);