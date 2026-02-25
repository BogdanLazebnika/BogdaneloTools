// assets/js/header.js

// Загрузка теми (незалежно від partial)
(function () {
    const saved = localStorage.getItem('lb_theme');
    if (saved === 'light') {
        document.body.classList.add('light-theme');
    }
})();

document.addEventListener('click', function (e) {

    const themeBtn = e.target.closest('#themeToggle');
    const mobileBtn = e.target.closest('#mobileMenuBtn');

    if (themeBtn) {
        document.body.classList.toggle('light-theme');

        const isLight = document.body.classList.contains('light-theme');
        themeBtn.textContent = isLight ? '☀️' : '🌙';

        localStorage.setItem('lb_theme', isLight ? 'light' : 'dark');
    }

    if (mobileBtn) {
        const mobileMenu = document.getElementById('mobileMenu');
        if (mobileMenu) {
            mobileMenu.classList.toggle('open');
        }
    }

});