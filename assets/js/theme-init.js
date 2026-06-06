(function(){
  var t = localStorage.getItem("kala_theme");
  var el = document.documentElement;
  if (t === "dark") {
    el.classList.add("theme-dark-pre");
    if (document.body) document.body.classList.add("theme-dark");
  }
  if (t === "sepia") {
    el.classList.add("theme-sepia-pre");
    if (document.body) document.body.classList.add("theme-sepia");
  }
})();
