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
  // Mobile navigation disclosure — replaces the old "menu just disappears
  // below 980px" behavior. Toggle button carries data-label-open/close
  // (already localized per-page in HTML) so this file stays
  // language-agnostic, matching bindLangSwitcher's own convention above.
  function bindNavToggle(){
    var toggle = document.querySelector('.navToggle');
    var menu = document.getElementById('primaryMenu');
    if(!toggle || !menu) return;

    function setOpen(open){
      menu.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      var label = open ? toggle.getAttribute('data-label-close') : toggle.getAttribute('data-label-open');
      if(label) toggle.setAttribute('aria-label', label);
    }

    toggle.addEventListener('click', function(){
      setOpen(!menu.classList.contains('open'));
    });

    // Escape closes the menu and returns focus to the toggle button.
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && menu.classList.contains('open')){
        setOpen(false);
        toggle.focus();
      }
    });

    // Clicking a nav link closes the panel (single-page navigation still
    // reloads to a new URL here, but this keeps state correct for
    // back/forward-cache restores).
    menu.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ setOpen(false); });
    });

    // Click outside the nav closes it too.
    document.addEventListener('click', function(e){
      if(!menu.classList.contains('open')) return;
      if(menu.contains(e.target) || toggle.contains(e.target)) return;
      setOpen(false);
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    setActiveNav();
    bindLangSwitcher();
    bindNavToggle();
  });
})();
