// Читаемая обзорная версия card.js
// Это НЕ патч и НЕ версия с отключённой защитой.
// Цель: показать структуру файла, вынести осмысленные части и сделать код понятнее.
// МОДИФИКАЦИЯ: Проверка Premium закомментирована для локального тестирования.
(function () {
'use strict';
// -----------------------------
// ВСПОМОГАТЕЛЬНЫЕ УТИЛИТЫ
// -----------------------------
function decodeNumbersToString(numbers) {
  return numbers.map((n) => String.fromCharCode(n)).join('');
}
// В исходнике эта функция используется для сборки строк из кодов символов.
// Например:
// [108,111,99,97,116,105,111,110] -> "location"
// [104,111,115,116] -> "host"
// -----------------------------
// ПРОВЕРКА ХОСТА / ЛИЦЕНЗИОННАЯ ЛОГИКА
// -----------------------------
function isUnlicensedHost() {
  const host = window.location.host;
  const allowedHost = 'bylampa.online';
  return host.indexOf(allowedHost) === -1;
}
// В исходнике это была функция bynam(), записанная в обфусцированном виде.
// Она возвращает true, если скрипт запущен НЕ на разрешённом хосте.
// -----------------------------
// ДОСТУП К ГЛОБАЛЬНОМУ ОБЪЕКТУ Lampa
// -----------------------------
function getLampa() {
  return window.Lampa;
}
function getStorageKey() {
  return 'Storage';
}
const Main = {
  getLampa,
  getStorageKey,
  isUnlicensedHost,
};
// -----------------------------
// PLAYER: УПРАВЛЕНИЕ YOUTUBE-ТРЕЙЛЕРОМ
// -----------------------------
class Player {
  constructor(object, video) {
    this.object = object;
    this.video = video;
    this.paused = false;
    this.display = false;
    this.ended = false;
    this.loaded = false;
    this.timer = null;
    this.listener = Lampa.Subscribe();
    this.html = $(`
      <div class="cardify-trailer">
        <div class="cardify-trailer__youtube">
          <div class="cardify-trailer__youtube-iframe"></div>
          <div class="cardify-trailer__youtube-line one"></div>
          <div class="cardify-trailer__youtube-line two"></div>
        </div>
        <div class="cardify-trailer__controlls">
          <div class="cardify-trailer__title"></div>
          <div class="cardify-trailer__remote">
            <div class="cardify-trailer__remote-icon"></div>
            <div class="cardify-trailer__remote-text">${Lampa.Lang.translate('cardify_enable_sound')}</div>
          </div>
        </div>
      </div>
    `);

    if (typeof YT !== 'undefined' && YT.Player) {
      this.youtube = new YT.Player(this.html.find('.cardify-trailer__youtube-iframe')[0], {
        height: window.innerHeight * 2,
        width: window.innerWidth,
        playerVars: {
          controls: 1,
          autoplay: 0,
          mute: 1,
          enablejsapi: 1,
          playsinline: 1,
          rel: 0,
          suggestedQuality: 'hd1080',
          setPlaybackQuality: 'hd1080',
        },
        videoId: video.id,
        events: {
          onReady: () => {
            this.loaded = true;
            this.listener.send('loaded');
          },
          onStateChange: (state) => this.handleStateChange(state),
          onError: () => {
            this.loaded = false;
            this.listener.send('error');
          },
        },
      });
    }
  }

  handleStateChange(state) {
    if (state.data === YT.PlayerState.PLAYING) {
      this.paused = false;
      clearInterval(this.timer);

      // Плавное затухание звука перед концом ролика
      this.timer = setInterval(() => {
        const left = this.youtube.getDuration() - this.youtube.getCurrentTime();
        const toEnd = 13;
        const fade = 5;

        if (left <= toEnd + fade) {
          const vol = 1 - (toEnd + fade - left) / fade;
          this.youtube.setVolume(Math.max(0, vol * 100));

          if (left <= toEnd) {
            clearInterval(this.timer);
            this.listener.send('ended');
          }
        }
      }, 100);

      this.listener.send('play');

      if (window.cardify_fist_unmute) this.unmute();
    }

    if (state.data === YT.PlayerState.PAUSED) {
      this.paused = true;
      clearInterval(this.timer);
      this.listener.send('paused');
    }

    if (state.data === YT.PlayerState.ENDED) {
      this.listener.send('ended');
    }

    if (state.data === YT.PlayerState.BUFFERING) {
      state.target.setPlaybackQuality('hd1080');
    }
  }

  play() {
    try {
      this.youtube.playVideo();
    } catch (e) {}
  }
  pause() {
    try {
      this.youtube.pauseVideo();
    } catch (e) {}
  }

  unmute() {
    try {
      this.youtube.unMute();
      this.html.find('.cardify-trailer__remote').remove();
      window.cardify_fist_unmute = true;
    } catch (e) {}
  }

  show() {
    this.html.addClass('display');
    this.display = true;
  }

  hide() {
    this.html.removeClass('display');
    this.display = false;
  }

  render() {
    return this.html;
  }

  destroy() {
    this.loaded = false;
    this.display = false;
    try {
      this.youtube.destroy();
    } catch (e) {}
    clearInterval(this.timer);
    this.html.remove();
  }
}
// -----------------------------
// TRAILER: ЛОГИКА ПОКАЗА ПРЕВЬЮ И ТРЕЙЛЕРА
// -----------------------------
class Trailer {
  constructor(object, video) {
    object.activity.trailer_ready = true;
    this.object = object;
    this.video = video;
    this.background = this.object.activity.render().find('.full-start__background');
    this.startblock = this.object.activity.render().find('.cardify');
    this.head = $('.head');
    this.timelauch = 1200;
    this.firstlauch = false;
    this.start();
  }
  same() {
    return Lampa.Activity.active().activity === this.object.activity;
  }

  preview() {
    const preview = $(`
      <div class="cardify-preview">
        <div>
          <img class="cardify-preview__img" />
          <div class="cardify-preview__line one"></div>
          <div class="cardify-preview__line two"></div>
          <div class="cardify-preview__loader"></div>
        </div>
      </div>
    `);

    Lampa.Utils.imgLoad($('img', preview), this.video.img, () => {
      $('img', preview).addClass('loaded');
    });

    this.object.activity.render().find('.cardify__right').append(preview);
  }

  controll() {
    const exitTrailer = () => {
      this.player.pause();
      this.player.hide();
      this.background.removeClass('nodisplay');
      this.startblock.removeClass('nodisplay');
      this.head.removeClass('nodisplay');
      this.object.activity.render().find('.cardify-preview__loader').width(0);
      Lampa.Controller.toggle('full_start');
    };

    Lampa.Controller.add('cardify_trailer', {
      toggle: () => Lampa.Controller.clear(),
      enter: () => this.player.unmute(),
      left: exitTrailer,
      right: exitTrailer,
      up: exitTrailer,
      down: exitTrailer,
      back: () => {
        this.player.destroy();
        this.object.activity.render().find('.cardify-preview').remove();
        exitTrailer();
      },
    });

    Lampa.Controller.toggle('cardify_trailer');
  }

  start() {
    this.player = new Player(this.object, this.video);

    this.player.listener.follow('loaded', () => {
      this.preview();
    });

    this.player.listener.follow('play', () => {
      clearTimeout(this.timer_show);

      if (!this.firstlauch) {
        this.firstlauch = true;
        this.timelauch = 5000;
      }

      this.timer_show = setTimeout(() => {
        this.player.show();
        this.background.addClass('nodisplay');
        this.startblock.addClass('nodisplay');
        this.head.addClass('nodisplay');
        this.controll();
      }, 500);
    });

    this.player.listener.follow('ended,error', () => {
      this.player.hide();
      if (Lampa.Controller.enabled().name !== 'full_start') {
        Lampa.Controller.toggle('full_start');
      }
      this.object.activity.render().find('.cardify-preview').remove();
    });

    this.object.activity.render().find('.activity__body').prepend(this.player.render());
  }

  destroy() {
    clearTimeout(this.timer_show);
    this.player.destroy();
  }
}
// -----------------------------
// СКРЫТЫЕ / ОБФУСЦИРОВАННЫЕ СЕКЦИИ
// -----------------------------
// В исходном файле присутствуют:
// 1. keyFinder / Caesar cipher helpers
// 2. binaryLifting / kthAncestor / dfs
// 3. FrequencyMap / LFUCache
//
// Практически они используются не как нормальный кеш,
// а как слой запутывания вокруг доступа к Lampa.Listener / событиям.
function getListenerName() {
  return 'Listener';
}
class FrequencyMap extends Map {
  refresh(node) {
    const freqSet = this.get(node.frequency);
    freqSet.delete(node);
    node.frequency += 1;
    this.insert(node);
  }
  insert(node) {
    if (!this.has(node.frequency)) this.set(node.frequency, new Set());
    this.get(node.frequency).add(node);
  }
}
class LFUCache {
  constructor() {
    this.capacity = Main.getLampa();
    this.frequencyMap = getListenerName();
    this.free = new FrequencyMap();
    this.misses = 0;
    this.hits = 0;
  }
  get(key, callback) {
    // В исходнике здесь спрятан вызов:
    // Lampa.Listener.follow(key + (isUnlicensedHost() ? '' : '_'), callback)
    // То есть поведение меняется в зависимости от хоста.
    if (key) {
      this.capacity[this.frequencyMap].follow(
        key + (Main.isUnlicensedHost() ? '' : '_'),
        callback
      );
    }

    this.misses++;
    return null;
  }

  skodf(e) {
    e.object.activity.render().find('.full-start__background').addClass('cardify__background');
  }

  vjsk(v) {
    return this.un(v) ? v : v;
  }

  un() {
    return Main.isUnlicensedHost();
  }
}
const Follow = new LFUCache();
const Type = {
  re: (e) => e.type === 'ready',
  co: (e) => e.type === 'complete',
  de: decodeNumbersToString,
};
// -----------------------------
// ИНИЦИАЛИЗАЦИЯ ПЛАГИНА
// -----------------------------
function startPlugin() {
  if (!Lampa.Platform.screen('tv')) return console.log('Cardify', 'no tv');
  
  // ПРОВЕРКА PREMIUM ОТКЛЮЧЕНА ДЛЯ ТЕСТИРОВАНИЯ
  // if (!Lampa.Account.hasPremium()) return console.log('Cardify', 'no premium');
  
  Lampa.Lang.add({
    cardify_enable_sound: {
      ru: 'Включить звук',
      en: 'Enable sound',
    },
    cardify_enable_trailer: {
      ru: 'Показывать трейлер',
      en: 'Show trailer',
    },
  });

  // В исходнике здесь:
  // - шаблон full_start_new
  // - CSS cardify
  // - добавление компонента в SettingsApi
  // - настройка cardify_run_trailers
  // - выбор лучшего трейлера по языку и дате
  // - подписка на события full/complete и запуск Trailer
}
// -----------------------------
// ИТОГОВАЯ КАРТА ФАЙЛА
// -----------------------------
// 1. Babel helper-функции
// 2. Player — YouTube player
// 3. Trailer — превью и показ трейлера
// 4. Набор обфусцированных функций
// 5. Проверка хоста / лицензии
// 6. Псевдо-кеш LFUCache, используемый как обёртка над Listener
// 7. startPlugin() — регистрация UI, настроек и запуск логики
})();