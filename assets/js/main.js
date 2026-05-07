(function(){
  function setActiveNav(){
    var path = window.location.pathname.replace(/\/$/, '');
    var links = document.querySelectorAll('[data-nav]');
    links.forEach(function(a){
      var href = a.getAttribute('href');
      if(!href) return;
      var full = new URL(href, window.location.origin);
      var hp = full.pathname.replace(/\/$/, '');
      if(hp === path) a.classList.add('active');
    });
  }
  function bindLangSwitcher(){
    var sw = document.querySelectorAll('a[data-lang]');
    if(!sw.length) return;
    var current = document.documentElement.getAttribute('data-lang') || 'en';
    var path = window.location.pathname;
    function mapToLang(target){
      var parts = path.split('/').filter(Boolean);
      if(parts.length && (parts[0]==='en'||parts[0]==='ar'||parts[0]==='ku')){
        parts[0] = target;
        return '/' + parts.join('/') + (path.endsWith('/') ? '/' : '');
      }
      return '/' + target + '/';
    }
    sw.forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        var target = a.getAttribute('data-lang');
        window.location.href = mapToLang(target);
      });
    });
    document.querySelectorAll('.lang a').forEach(function(a){
      if(a.getAttribute('data-lang')===current) a.classList.add('active');
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    setActiveNav();
    bindLangSwitcher();
  });
})();
