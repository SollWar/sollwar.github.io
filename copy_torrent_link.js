(function () {
    'use strict';

    function copyToClipboard(text) {

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        }
        else {
            var textarea = document.createElement("textarea");
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
        }
    }

    function initPlugin(){

        Lampa.Listener.follow('player', function(e){

            if(e.type === 'start' && e.data && e.data.url){

                var torrentUrl = e.data.url;

                copyToClipboard(torrentUrl);

                Lampa.Noty.show('Ссылка на поток скопирована');
            }
        });

    }

    if (window.appready) initPlugin();
    else Lampa.Listener.follow('app', function(e){
        if(e.type === 'ready') initPlugin();
    });

})();
