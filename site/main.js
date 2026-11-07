// 내 컴퓨터 종류에 맞는 다운로드 버튼을 강조하고, 설치 명령 복사 버튼을 동작시킨다.
(function () {
  var ua = navigator.userAgent || '';
  var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  var os = null;
  if (/Win/i.test(platform) || /Windows/i.test(ua)) os = 'win';
  else if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) os = 'mac';

  function mark(key, hint) {
    var el = document.querySelector('.dl[data-os="' + key + '"]');
    if (!el) return;
    el.classList.add('recommended');
    var hero = document.getElementById('hero-download');
    if (hero) hero.setAttribute('href', el.getAttribute('href'));
    var h = document.getElementById('os-hint');
    if (h) h.textContent = hint;
  }

  if (os === 'win') mark('win', 'Windows 컴퓨터로 보여요.');
  else if (os === 'mac') {
    // 크롬 계열은 칩 종류를 알려 준다. 모르면 애플 실리콘을 먼저 추천한다(최근 맥 대부분).
    mark('mac-arm', '맥으로 보여요.');
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      navigator.userAgentData.getHighEntropyValues(['architecture']).then(function (v) {
        if (v.architecture === 'x86') {
          document.querySelector('.dl[data-os="mac-arm"]').classList.remove('recommended');
          mark('mac-intel', '인텔 맥으로 보여요.');
        }
      }).catch(function () {});
    }
  }

  document.querySelectorAll('button.copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var code = document.getElementById(btn.getAttribute('data-copy'));
      if (!code || !navigator.clipboard) return;
      navigator.clipboard.writeText(code.textContent.trim()).then(function () {
        var old = btn.textContent;
        btn.textContent = '복사했어요';
        setTimeout(function () { btn.textContent = old; }, 1800);
      });
    });
  });
})();
