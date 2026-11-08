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

  // 설치 파일이 실제로 올라와 있는지 GitHub에 물어본다.
  // 아직 릴리스가 없으면 404 페이지로 보내지 않고 "준비 중" 안내를 보여 준다.
  // 릴리스가 있으면 버튼을 실제 파일 주소로 바꾼다(파일 이름이 달라도 동작하도록).
  var REPO = 'philosophyAIEDU/261107claudeworkspace';
  var status = document.getElementById('release-status');
  var buttons = document.querySelectorAll('.dl');
  var patterns = { win: /\.exe$/i, 'mac-arm': /arm64\.dmg$/i, 'mac-intel': /x64\.dmg$/i };

  function showNotice(html) {
    if (!status) return;
    status.innerHTML = html;
    status.hidden = false;
  }

  if (window.fetch) {
    fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (res) {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('status ' + res.status);
        return res.json();
      })
      .then(function (release) {
        if (!release) {
          buttons.forEach(function (b) {
            b.setAttribute('aria-disabled', 'true');
            b.removeAttribute('href');
          });
          var hero = document.getElementById('hero-download');
          if (hero) hero.setAttribute('href', '#download');
          showNotice('<p>🛠️ <strong>설치 파일을 준비하고 있어요.</strong> 곧 이곳에서 내려받을 수 있어요.</p>');
          return;
        }
        var assets = release.assets || [];
        var missing = [];
        buttons.forEach(function (b) {
          var re = patterns[b.getAttribute('data-os')];
          var asset = assets.filter(function (a) { return re && re.test(a.name); })[0];
          if (asset) {
            b.setAttribute('href', asset.browser_download_url);
          } else {
            b.setAttribute('aria-disabled', 'true');
            b.removeAttribute('href');
            missing.push(b.querySelector('.dl-title').textContent);
          }
        });
        var rec = document.querySelector('.dl.recommended[href]');
        var hero2 = document.getElementById('hero-download');
        if (hero2) hero2.setAttribute('href', rec ? rec.getAttribute('href') : '#download');
        if (missing.length) showNotice('<p>' + missing.join(', ') + '용 설치 파일은 아직 준비 중이에요.</p>');
      })
      .catch(function () {
        // GitHub에 연결이 안 되면 기존 링크(/download/...)를 그대로 둔다.
      });
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
