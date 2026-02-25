// ===== LOAD THEME =====
(function () {
    const saved = localStorage.getItem('lb_theme');
    
    if (saved) {
        // Якщо користувач вже обирав тему - використовуємо його вибір
        if (saved === 'light') {
            document.body.classList.add('light-theme');
        }
    } else {
        // Авто-вибір на основі системних налаштувань
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            document.body.classList.add('light-theme');
            localStorage.setItem('lb_theme', 'light');
        } else {
            localStorage.setItem('lb_theme', 'dark');
        }
    }
    
    // Оновити іконку кнопки при завантаженні
    updateThemeButtonIcon();
})();

// ===== GLOBAL CLICK HANDLER =====
document.addEventListener('click', function (e) {
    const themeBtn = e.target.closest('#themeToggle');
    const burger = e.target.closest('#mobileMenuBtn');
    const overlay = document.getElementById('mobileOverlay');
    const mobileMenu = document.getElementById('mobileMenu');
    const dropdownBtn = e.target.closest('.mobile-dropdown-btn');

    /* THEME */
    if (themeBtn) {
        document.body.classList.toggle('light-theme');

        const isLight = document.body.classList.contains('light-theme');
        themeBtn.textContent = isLight ? '☀️' : '🌙';

        localStorage.setItem('lb_theme', isLight ? 'light' : 'dark');
        return;
    }

    /* BURGER */
    if (burger) {
        toggleMenu();
        return;
    }

    /* MOBILE DROPDOWN */
    if (dropdownBtn) {
        const dropdown = dropdownBtn.closest('.mobile-dropdown');
        dropdown.classList.toggle('active');
        return;
    }

    /* CLICK OUTSIDE (overlay) */
    if (overlay && e.target === overlay) {
        closeMenu();
        return;
    }

    /* CLICK OUTSIDE DROPDOWN (in mobile menu) */
    if (mobileMenu && mobileMenu.classList.contains('open') && 
        !e.target.closest('.mobile-dropdown')) {
        const activeDropdown = mobileMenu.querySelector('.mobile-dropdown.active');
        if (activeDropdown) {
            activeDropdown.classList.remove('active');
        }
    }
});

// ===== ESC KEY =====
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeMenu();
    }
});

// ===== THEME CHANGE LISTENER (опціонально) =====
// Слідкує за зміною системної теми в реальному часі
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    const saved = localStorage.getItem('lb_theme');
    // Змінюємо тему тільки якщо користувач ще не робив власний вибір
    if (!saved) {
        if (e.matches) {
            document.body.classList.add('light-theme');
            localStorage.setItem('lb_theme', 'light');
        } else {
            document.body.classList.remove('light-theme');
            localStorage.setItem('lb_theme', 'dark');
        }
        updateThemeButtonIcon();
    }
});

function updateThemeButtonIcon() {
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        const isLight = document.body.classList.contains('light-theme');
        themeBtn.textContent = isLight ? '☀️' : '🌙';
    }
}

function toggleMenu(){
    const burger = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileOverlay');

    if (!burger || !mobileMenu || !overlay) return;

    burger.classList.toggle('active');
    mobileMenu.classList.toggle('open');
    overlay.classList.toggle('active');
    document.body.classList.toggle('menu-open');
}

function closeMenu(){
    const burger = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileOverlay');

    if (!burger || !mobileMenu || !overlay) return;

    burger.classList.remove('active');
    mobileMenu.classList.remove('open');
    overlay.classList.remove('active');
    document.body.classList.remove('menu-open');
    
    // Закриваємо всі відкриті dropdown
    const activeDropdowns = mobileMenu.querySelectorAll('.mobile-dropdown.active');
    activeDropdowns.forEach(dropdown => {
        dropdown.classList.remove('active');
    });
}
