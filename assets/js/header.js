export function setActiveMenu() {
    const path = location.pathname;
    document.querySelectorAll('nav a').forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === path);
    });
}
document.addEventListener('DOMContentLoaded', setActiveMenu);
