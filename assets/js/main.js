function getBasePath() {
    const { hostname, pathname } = window.location;

    if (hostname.includes('github.io')) {
        const segments = pathname.split('/').filter(Boolean);
        return segments.length > 0 ? `/${segments[0]}/` : '/';
    }

    return '/';
}

const BASE_PATH = getBasePath();

/* DATA-LINK NAVIGATION */
document.addEventListener("click", function (e) {
    const link = e.target.closest("[data-link]");
    if (!link) return;

    e.preventDefault();

    const path = link.dataset.link;
    window.location.href = BASE_PATH + path;
});


/* FIX SVG ICON PATHS */
window.fixIcons = function () {

    const icons = document.querySelectorAll("use[data-icon]");

    icons.forEach(icon => {
        const path = icon.dataset.icon;
        icon.setAttribute("href", BASE_PATH + path);
    });

}


/* LOAD PARTIAL */
export async function loadPartial(url, containerSelector) {

    const resp = await fetch(BASE_PATH + url);

    if (!resp.ok) throw new Error(`Failed to load ${url}`);

    const html = await resp.text();
    const container = document.querySelector(containerSelector);
    if (!container) return;

    container.innerHTML = html;

    const scripts = container.querySelectorAll('script');

    scripts.forEach(oldScript => {
        const newScript = document.createElement('script');

        [...oldScript.attributes].forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
        });

        newScript.textContent = oldScript.textContent;

        oldScript.replaceWith(newScript);
    });
}


/* AUTO LOAD HEADER + FOOTER */
document.addEventListener('DOMContentLoaded', async () => {

    await loadPartial('partials/header.html', 'header');
    await loadPartial('partials/footer.html', 'footer');

    fixIcons();

});