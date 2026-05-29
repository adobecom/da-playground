(function() {
  // Prevent default on all placeholder links
  document.querySelectorAll('a[href="#"]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
    });
  });

  // Plans tab switcher
  var tabBtns = document.querySelectorAll('.ptab-btn');
  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      tabBtns.forEach(function(b) {
        b.classList.remove('active');
        b.classList.add('inactive');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.remove('inactive');
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    });
  });
})();
