(function () {
    'use strict';

    if (window.__lampa_ext_player_plugin__) return;
    window.__lampa_ext_player_plugin__ = true;

    var CONFIG = {
        // Для VLC:
        // получится что-то вроде vlc://https://site/video.m3u8
        vlcProtocol: 'vlc://',

        // Для своего локального плеера.
        // Это должен быть ЗАРАНЕЕ зарегистрированный в Windows протокол.
        // Например:
        // lampaplayer://play?url=https%3A%2F%2Fsite%2Fvideo.m3u8
        localProtocol: 'lampaplayer://play?url=',

        // Названия пунктов меню
        vlcLabel: 'Запустить VLC',
        localLabel: 'Запустить локальный плеер',

        // Показывать ли обе кнопки
        showVlc: true,
        showLocal: true
    };

    function log() {
        console.log('[Lampa ext player]', [].slice.call(arguments).join(' '));
    }

    function notify(text) {
        try {
            if (window.Lampa && Lampa.Noty && Lampa.Noty.show) {
                Lampa.Noty.show(text);
            } else {
                console.log(text);
            }
        } catch (e) {
            console.log(text);
        }
    }

    function encodeUrl(url) {
        return encodeURIComponent(url || '');
    }

    function normalizeUrl(url) {
        if (!url) return '';
        return String(url).trim();
    }

    function getVideoFromHtml5() {
        try {
            var video = document.querySelector('video');
            if (!video) return '';
            return normalizeUrl(video.currentSrc || video.src || '');
        } catch (e) {
            return '';
        }
    }

    function getVideoFromLampaPlayer() {
        try {
            if (!window.Lampa || !Lampa.Player) return '';

            // Попытка №1: некоторые сборки держат активный объект
            if (Lampa.Player.playlist && typeof Lampa.Player.playlist === 'function') {
                var pl = Lampa.Player.playlist();
                if (Array.isArray(pl)) {
                    for (var i = 0; i < pl.length; i++) {
                        var item = pl[i];
                        if (!item) continue;

                        if (typeof item.url === 'string' && item.url) return normalizeUrl(item.url);

                        // Иногда url — функция-ленивка
                        // Ее здесь безопасно не дергаем
                    }
                }
            }

            // Попытка №2: некоторые сборки имеют current/active/stream
            var candidates = [
                Lampa.Player.current,
                Lampa.Player.active,
                Lampa.Player.stream,
                Lampa.Player.video,
                Lampa.Player.data
            ];

            for (var j = 0; j < candidates.length; j++) {
                var c = candidates[j];
                if (!c) continue;

                if (typeof c === 'function') {
                    try {
                        c = c();
                    } catch (e) {
                        c = null;
                    }
                }

                if (!c) continue;

                if (typeof c.url === 'string' && c.url) return normalizeUrl(c.url);
                if (typeof c.src === 'string' && c.src) return normalizeUrl(c.src);
                if (typeof c.stream === 'string' && c.stream) return normalizeUrl(c.stream);
            }
        } catch (e) {}

        return '';
    }

    function getCurrentVideoUrl() {
        var url = '';

        // Сначала пробуем Lampa API/объекты
        url = getVideoFromLampaPlayer();
        if (url) return url;

        // Потом HTML5 video
        url = getVideoFromHtml5();
        if (url) return url;

        return '';
    }

    function buildVlcUrl(videoUrl) {
        return CONFIG.vlcProtocol + videoUrl;
    }

    function buildLocalPlayerUrl(videoUrl) {
        return CONFIG.localProtocol + encodeUrl(videoUrl);
    }

    function openExternal(url) {
        try {
            window.location.href = url;
            return true;
        } catch (e) {
            log('openExternal error', e && e.message ? e.message : e);
            return false;
        }
    }

    function handleOpen(kind) {
        var videoUrl = getCurrentVideoUrl();

        if (!videoUrl) {
            notify('Не удалось получить ссылку на видео');
            return;
        }

        var targetUrl = '';

        if (kind === 'vlc') {
            targetUrl = buildVlcUrl(videoUrl);
        } else if (kind === 'local') {
            targetUrl = buildLocalPlayerUrl(videoUrl);
        }

        if (!targetUrl) {
            notify('Не удалось сформировать ссылку запуска');
            return;
        }

        log('open', kind, targetUrl);
        openExternal(targetUrl);
    }

    function textOf(el) {
        return (el && el.textContent ? el.textContent : '').trim();
    }

    function hasActionMenu(root) {
        if (!root) return false;
        var text = root.innerText || root.textContent || '';
        return text.indexOf('Копировать ссылку на видео') >= 0 ||
               text.indexOf('Запустить плеер - Lampa') >= 0 ||
               text.indexOf('Сбросить тайм-код') >= 0;
    }

    function findActionRoots() {
        var nodes = document.querySelectorAll('body *');
        var out = [];

        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (!el || !el.children || !el.children.length) continue;

            if (hasActionMenu(el)) out.push(el);
        }

        return out;
    }

    function alreadyInjected(root) {
        return !!root.querySelector('[data-ext-player-btn="1"]');
    }

    function findBestTemplateItem(root) {
        var all = root.querySelectorAll('*');
        var fallback = null;

        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            var txt = textOf(el);

            if (!txt) continue;

            if (
                txt === 'Копировать ссылку на видео' ||
                txt === 'Запустить плеер - Lampa' ||
                txt === 'Просмотрено' ||
                txt === 'Сбросить тайм-код'
            ) {
                return el;
            }

            if (!fallback && txt.length < 40) fallback = el;
        }

        return fallback;
    }

    function makeButtonFromTemplate(template, label, onClick) {
        var btn = template.cloneNode(true);
        btn.setAttribute('data-ext-player-btn', '1');

        // Чистим возможные старые обработчики заменой узла
        var fresh = btn.cloneNode(true);
        btn.parentNode && btn.parentNode.replaceChild(fresh, btn);
        btn = fresh;

        // Меняем текст
        var changed = false;
        var descendants = btn.querySelectorAll('*');

        for (var i = 0; i < descendants.length; i++) {
            var node = descendants[i];
            if (node.children.length === 0 && textOf(node)) {
                node.textContent = label;
                changed = true;
                break;
            }
        }

        if (!changed) btn.textContent = label;

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        }, true);

        return btn;
    }

    function injectIntoRoot(root) {
        if (!root || alreadyInjected(root)) return;

        var template = findBestTemplateItem(root);
        if (!template || !template.parentNode) return;

        if (CONFIG.showVlc) {
            var vlcBtn = makeButtonFromTemplate(template, CONFIG.vlcLabel, function () {
                handleOpen('vlc');
            });
            template.parentNode.appendChild(vlcBtn);
        }

        if (CONFIG.showLocal) {
            var localBtn = makeButtonFromTemplate(template, CONFIG.localLabel, function () {
                handleOpen('local');
            });
            template.parentNode.appendChild(localBtn);
        }

        log('buttons injected');
    }

    function scan() {
        var roots = findActionRoots();
        for (var i = 0; i < roots.length; i++) {
            injectIntoRoot(roots[i]);
        }
    }

    function startObserver() {
        var observer = new MutationObserver(function () {
            scan();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        scan();
    }

    function init() {
        notify('Плагин внешнего плеера загружен');
        startObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
