/* Backroom Admin Preview enhancement layer v1.02 */
(() => {
    'use strict';

    const PLACEHOLDER = {
        standard: 'placeholder_venue.jpg',
        cruiseIndoor: 'placeholder_venue12.jpg',
        cruiseOutdoor: 'placeholder_venue13.jpg',
        sauna: 'placeholder_venue14.jpg'
    };

    function normalise(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '');
    }

    function cruisingFallback(venue) {
        const text = normalise([venue?.Name, venue?.Description, venue?.Address, venue?.Native_Map_Query].filter(Boolean).join(' '));
        const indoor = ['toilet', 'toilets', 'bathroom', 'bathrooms', 'restroom', 'restrooms', 'urinal', 'urinals', 'publicwc', 'station', 'railway'];
        return indoor.some(word => text.includes(word)) ? PLACEHOLDER.cruiseIndoor : PLACEHOLDER.cruiseOutdoor;
    }

    function fallbackFor(venue) {
        if (String(venue?.Category || '').trim().toLowerCase() === 'cruising area') return cruisingFallback(venue);
        if (String(venue?.Category || '').trim().toLowerCase() === 'sauna') return PLACEHOLDER.sauna;
        return PLACEHOLDER.standard;
    }

    function getPayload() {
        try {
            return JSON.parse(localStorage.getItem('br_admin_record_preview_payload') || 'null');
        } catch {
            return null;
        }
    }

    function installStyle() {
        if (document.getElementById('admin-preview-enhancement-styles')) return;
        const style = document.createElement('style');
        style.id = 'admin-preview-enhancement-styles';
        style.textContent = `
            .preview-shell.preview-men-only {
                border: 2px solid var(--red);
            }

            .preview-shell.preview-cruising-area {
                border: 2px solid var(--red);
                background: linear-gradient(180deg, var(--surface) 0%, #3a1014 100%);
            }

            .preview-shell.preview-cruising-area .record-header,
            .preview-shell.preview-cruising-area .record-content {
                background-color: rgba(72, 11, 17, .48);
            }
        `;
        document.head.appendChild(style);
    }

    function apply() {
        const payload = getPayload();
        const venue = payload?.mode === 'venues' ? payload.record : null;
        if (!venue) return;

        const root = document.getElementById('preview-root');
        const shell = root?.querySelector('.preview-shell');
        if (!shell) return;

        const cruising = String(venue?.Category || '').trim().toLowerCase() === 'cruising area';
        const menOnly = String(venue?.Vibe_Tags || '').split(',').map(tag => tag.trim()).includes('Men Only');

        shell.classList.toggle('preview-cruising-area', cruising);
        shell.classList.toggle('preview-men-only', !cruising && menOnly);

        const image = shell.querySelector('.media-panel img');
        if (!image) return;

        const fallback = fallbackFor(venue);
        image.onerror = () => {
            if (image.dataset.brPreviewFallback === 'true') return;
            image.dataset.brPreviewFallback = 'true';
            image.src = fallback;
        };
    }

    installStyle();

    const root = document.getElementById('preview-root');
    if (root) {
        const observer = new MutationObserver(apply);
        observer.observe(root, { childList: true, subtree: true });
    }

    apply();
})();