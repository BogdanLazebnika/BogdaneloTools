// assets/js/index.js
const toggle = document.getElementById('theme-toggle');

if (toggle) {
    toggle.addEventListener('click', () => {
        document.documentElement.dataset.theme =
            document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        // Ви можете змінити колірні змінні в CSS за допомогою
        // [data-theme="light"] { --color-bg-1: #f5f5f5; ... }
    });
}
