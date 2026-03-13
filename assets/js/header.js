// ===== LOAD THEME =====
(function () {

    const saved = localStorage.getItem('lb_theme');

    if (saved) {

        if (saved === 'light') {
            document.body.classList.add('light-theme');
        }

    } else {

        if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            document.body.classList.add('light-theme');
            localStorage.setItem('lb_theme', 'light');
        } else {
            localStorage.setItem('lb_theme', 'dark');
        }

    }

    waitForThemeButton();

})();


// ===== ЧЕКАЄМО ПОКИ З'ЯВИТЬСЯ КНОПКА =====
function waitForThemeButton() {

    const interval = setInterval(() => {

        const themeBtn = document.getElementById('themeToggle');

        if (themeBtn) {
            updateThemeButtonIcon();
            clearInterval(interval);
        }

    }, 30);

}


// ===== GLOBAL CLICK HANDLER =====
document.addEventListener('click', function (e) {

    const themeBtn = e.target.closest('#themeToggle');
    const burger = e.target.closest('#mobileMenuBtn');
    const overlay = document.getElementById('mobileOverlay');
    const mobileMenu = document.getElementById('mobileMenu');
    const dropdownBtn = e.target.closest('.mobile-dropdown__btn');


    /* THEME */
    if (themeBtn) {

        document.body.classList.toggle('light-theme');

        const isLight = document.body.classList.contains('light-theme');

        localStorage.setItem('lb_theme', isLight ? 'light' : 'dark');

        updateThemeButtonIcon();

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


    /* OVERLAY CLICK */
    if (overlay && e.target === overlay) {
        closeMenu();
        return;
    }


    /* CLICK OUTSIDE DROPDOWN */
    if (mobileMenu && mobileMenu.classList.contains('open') &&
        !e.target.closest('.mobile-dropdown')) {

        const activeDropdown = mobileMenu.querySelector('.mobile-dropdown.active');

        if (activeDropdown) {
            activeDropdown.classList.remove('active');
        }

    }

});


// ===== ESC =====
document.addEventListener('keydown', function (e) {

    if (e.key === 'Escape') {
        closeMenu();
    }

});


// ===== SYSTEM THEME LISTENER =====
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {

    const saved = localStorage.getItem('lb_theme');

    if (!saved) {

        if (e.matches) {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }

        updateThemeButtonIcon();

    }

});


// ===== UPDATE ICON =====
function updateThemeButtonIcon() {

    const themeBtn = document.getElementById('themeToggle');
    if (!themeBtn) return;

    const icon = themeBtn.querySelector('use');
    if (!icon) return;

    const isLight = document.body.classList.contains('light-theme');

    const iconPath = isLight
        ? "assets/img/icons/icons.svg#sun-ico"
        : "assets/img/icons/icons.svg#moon-ico";

    icon.setAttribute("data-icon", iconPath);

    if (window.fixIcons) {
        window.fixIcons();
    }

}


// ===== MENU =====
function toggleMenu() {

    const burger = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileOverlay');

    if (!burger || !mobileMenu || !overlay) return;

    burger.classList.toggle('active');
    mobileMenu.classList.toggle('open');
    overlay.classList.toggle('active');
    document.body.classList.toggle('menu-open');

}


function closeMenu() {

    const burger = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileOverlay');

    if (!burger || !mobileMenu || !overlay) return;

    burger.classList.remove('active');
    mobileMenu.classList.remove('open');
    overlay.classList.remove('active');

    document.body.classList.remove('menu-open');

    const activeDropdowns = mobileMenu.querySelectorAll('.mobile-dropdown.active');

    activeDropdowns.forEach(dropdown => {
        dropdown.classList.remove('active');
    });

}
// ===== MOBILE SUBMENU LOGIC =====
document.addEventListener('click', function (e) {

    // Знаходимо кнопку розгортання підменю у всіх mobile-submenu-item-title
    const submenuToggle = e.target.closest('.mobile-submenu-item__arrow, .mobile-submenu-item-title > .mobile-submenu-item');

    if (submenuToggle) {

        // parent контейнер підменю
        const submenuWrapper = submenuToggle.closest('.mobile-submenu-item-title');

        if (!submenuWrapper) return;

        submenuWrapper.classList.toggle('active');

        // Згортаємо інші відкриті підменю всередині того ж dropdown
        const siblingSubmenus = Array.from(submenuWrapper.parentElement.querySelectorAll('.mobile-submenu-item-title.active'))
            .filter(el => el !== submenuWrapper);

        siblingSubmenus.forEach(el => el.classList.remove('active'));

        return;
    }

});