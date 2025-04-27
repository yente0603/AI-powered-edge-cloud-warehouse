// src/uiInteraction.js
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleButton = document.querySelector('.sidebar-toggle-button');
    const overlay = document.getElementById('overlay');
    const body = document.body;
    
    if (!sidebar || !toggleButton || !overlay) {
        console.warn("Sidebar elements not found, skipping setup.");
        return;
    }

    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        body.classList.add('sidebar-open');
        toggleButton.setAttribute('aria-expanded', 'true');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        body.classList.remove('sidebar-open');
        toggleButton.setAttribute('aria-expanded', 'false');
    }

    toggleButton.addEventListener('click', (event) => {
        event.stopPropagation()
        if (sidebar.classList.contains('open')) {
            closeSidebar();
        }
        else {
            openSidebar();
        }
    });

    overlay.addEventListener('click', () => {
        closeSidebar();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });

    try {
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const navLinks = sidebar.querySelectorAll('ul a');
        navLinks.forEach(link => {
            const linkPath = link.getAttribute('href');
            if (linkPath === currentPath) {
                link.classList.add('active');
            }
            else {
                link.classList.remove('active');
            }
        });
    }
    catch (e) {
        console.error("Error highlighting active sidebar link:", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupSidebar();
});