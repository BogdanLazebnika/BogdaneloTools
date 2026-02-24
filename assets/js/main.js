export async function loadPartial(url, containerSelector) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to load ${url}`);
    const html = await resp.text();
    document.querySelector(containerSelector).innerHTML = html;
}

/* автозапуск на всіх сторінках */
document.addEventListener('DOMContentLoaded', () => {
    loadPartial('./partials/header.html', 'header');
    loadPartial('./partials/footer.html', 'footer');
});
