(function () {
    'use strict';

    function copy(text){
        if(navigator.clipboard){
            navigator.clipboard.writeText(text);
        }
    }

    function showDialog(url){

        var html = `
        <div style="padding:20px">
            <div style="font-size:20px;margin-bottom:15px">
                Открыть торрент во внешнем плеере
            </div>

            <input value="${url}" style="
                width:100%;
                padding:10px;
                margin-bottom:15px;
                background:#111;
                color:#fff;
                border:1px solid #444;
            ">

            <div style="display:flex;gap:10px">

                <div class="simple-button copy">
                    📋 Копировать
                </div>

                <div class="simple-button vlc">
                    ▶ Открыть в VLC
                </div>

            </div>
        </div>
        `;

        var dialog = Lampa.Modal.open({
            title: 'Внешний плеер',
            html: html
        });

        dialog.find('.copy').on('hover:enter', function(){
            copy(url);
            Lampa.Noty.show('Ссылка скопирована');
        });

        dialog.find('.vlc').on('hover:enter', function(){

            copy(url);

            // попытка открыть VLC
            window.location.href = 'vlc://' + encodeURIComponent(url);

            Lampa.Noty.show('Попытка открыть VLC');
        });
    }

    function init(){

        Lampa.Listener.follow('torrent', function(e){

            if(e.type === 'play' && e.data && e.data.url){

                showDialog(e.data.url);

                return false;
            }
        });

    }

    if(window.appready) init();
    else Lampa.Listener.follow('app', function(e){
        if(e.type === 'ready') init();
    });

})();
