# 보안 안내 — 필로소피 Claude 작업실

이 문서는 앱을 쓰는 분과 나눠 주는 분을 위한 안내예요.

## 1. 이 앱이 하는 일과 하지 않는 일

| | |
| --- | --- |
| ✅ 하는 일 | 내 컴퓨터에 설치된 Claude Code를 터미널에서 실행하고, 작업 폴더·대화 목록을 내 컴퓨터에 저장해요. |
| ❌ 하지 않는 일 | API 키나 비밀번호를 묻거나 저장하지 않아요. 대화 내용·파일을 어디로도 보내지 않아요. 분석·추적·광고 기능이 없어요. 자동 업데이트도 없어요. |
| 🌐 인터넷 연결 | 앱이 스스로 접속하는 곳은 없어요. 예외는 사용자가 누를 때뿐이에요: 링크 열기(기본 브라우저), [🪄 자동으로 설치하기](공식 `claude.ai` 설치 스크립트 실행). AI 대화는 Claude Code가 직접 Anthropic과 주고받아요. |
| 💾 저장 위치 | 앱 데이터: Windows `%APPDATA%\필로소피 Claude 작업실\`, macOS `~/Library/Application Support/필로소피 Claude 작업실/`. 대화 원본은 Claude Code의 `~/.claude/projects/`(앱은 읽기만 해요). |

## 2. 받은 설치 파일이 진짜인지 확인하기

설치 파일은 GitHub Actions가 이 저장소의 코드로 직접 만들어 [GitHub Releases](https://github.com/philosophyAIEDU/261107claudeworkspace/releases)에 올려요. 릴리스마다 두 가지 확인 수단이 함께 있어요.

**① 파일 지문(SHA-256)** — 릴리스의 `SHA256SUMS.txt`, 또는 릴리스 설명에 적힌 값과 비교해요.
- Windows(PowerShell): `Get-FileHash .\PhilosophyClaudeWorkroom-Setup.exe -Algorithm SHA256`
- macOS(터미널): `shasum -a 256 PhilosophyClaudeWorkroom-mac-arm64.dmg`

값이 한 글자라도 다르면 실행하지 마세요.

**② GitHub 빌드 증명(attestation)** — GitHub CLI가 있다면:
```
gh attestation verify PhilosophyClaudeWorkroom-Setup.exe --repo philosophyAIEDU/261107claudeworkspace
```
이 저장소의 릴리스 워크플로가 만든 파일인지 GitHub가 서명으로 보증해요. (v0.1.1부터 적용)

## 3. "Windows의 PC 보호"·"확인되지 않은 개발자" 경고가 뜨는 이유

바이러스라서가 아니라 **코드 서명(발행자 증명)이 아직 없기 때문**이에요.
- Windows SmartScreen은 서명이 없거나, 아직 내려받은 사람이 적은 프로그램에 경고를 띄워요.
- macOS Gatekeeper는 Apple 개발자 인증서로 서명·공증(notarization)되지 않은 앱을 막아요.

경고를 넘기는 방법은 [README](README.md#서명-없는-앱-실행-경고-넘기기)에 있어요. 경고를 **없애려면** 아래 4번의 코드 서명이 필요해요.

### 백신이 잘못 막을 때(오탐)
1. [VirusTotal](https://www.virustotal.com)에 설치 파일을 올려 여러 백신의 결과를 확인해요.
2. Microsoft Defender가 막는다면 Microsoft의 파일 제출 페이지(https://www.microsoft.com/en-us/wdsi/filesubmission)에서 "소프트웨어 개발자"로 오탐 신고를 해요.
3. 다른 백신도 회사마다 오탐 신고 창구가 있어요.

## 4. 코드 서명 켜기 (관리자용)

릴리스 워크플로(`.github/workflows/release.yml`)는 저장소에 아래 값이 등록되어 있으면 **자동으로 서명**하고, 없으면 서명 없이 만들어요. 값은 GitHub 저장소의 **Settings → Secrets and variables → Actions**에 넣어요. 인증서·비밀번호는 절대 코드나 채팅에 붙여 넣지 마세요.

> 인증서 가격·발급 자격(개인/기관, 국가, 업력 등)은 자주 바뀌어요. 아래 서비스의 공식 안내를 직접 확인해 주세요.

### Windows — 둘 중 하나

**방법 A. Azure Artifact Signing(구 Trusted Signing, Microsoft의 클라우드 서명)**

| 종류 | 이름 | 값 |
| --- | --- | --- |
| Secret | `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` | 서명 권한을 준 Azure 앱 등록(서비스 주체) 정보 |
| Variable | `AZURE_SIGNING_ENDPOINT` | 예: `https://eus.codesigning.azure.net/` (계정 지역에 맞게) |
| Variable | `AZURE_SIGNING_ACCOUNT` | 코드 서명 계정 이름 |
| Variable | `AZURE_SIGNING_PROFILE` | 인증서 프로필 이름 |
| Variable | `AZURE_SIGNING_PUBLISHER` | 인증서의 발행자 이름(CN과 같아야 해요) |

**방법 B. 인증서 파일(.pfx)**

| 종류 | 이름 | 값 |
| --- | --- | --- |
| Secret | `WIN_CSC_LINK` | .pfx 파일을 base64로 바꾼 값 |
| Secret | `WIN_CSC_KEY_PASSWORD` | .pfx 비밀번호 |

> 참고: 요즘 발급되는 일반(OV) 코드 서명 인증서는 개인 키를 USB 토큰이나 클라우드 보관함(HSM)에만 두도록 되어 있어, .pfx 파일로 받지 못하는 경우가 많아요. 그런 경우 방법 A나 인증 기관의 클라우드 서명 도구를 써야 해요.

**무료 선택지:** 오픈소스 프로젝트는 SignPath Foundation(https://signpath.org) 같은 곳에서 무료 서명을 지원받을 수 있어요. 오픈소스 라이선스 파일(LICENSE)과 공개 저장소 등 조건이 있어요.

### macOS — Apple Developer Program 가입 후

| 종류 | 이름 | 값 |
| --- | --- | --- |
| Secret | `MAC_CSC_LINK` | "Developer ID Application" 인증서(.p12)를 base64로 바꾼 값 |
| Secret | `MAC_CSC_KEY_PASSWORD` | .p12 비밀번호 |
| Secret | `APPLE_ID` | Apple 계정 이메일 |
| Secret | `APPLE_APP_SPECIFIC_PASSWORD` | appleid.apple.com에서 만든 앱 암호 |
| Secret | `APPLE_TEAM_ID` | 개발자 팀 ID(10자리) |

등록한 뒤 Actions → release → Run workflow로 새 버전을 만들면 서명된 설치 파일이 나와요. 빌드 기록에 "서명해요"가 보이면 적용된 거예요.

## 5. 앱에 들어 있는 보안 장치

- **화면 격리**: 모든 화면은 운영체제 샌드박스 안에서 돌고(`sandbox`, `contextIsolation`), Node.js 기능에 직접 손댈 수 없어요. 화면이 할 수 있는 일은 정해진 요청 목록뿐이고, 메인 프로세스가 모든 요청을 검사(zod)해요.
- **파일 울타리**: 등록한 작업 폴더 밖의 파일은 읽거나 쓸 수 없어요(`..`·심볼릭 링크 우회 차단). 지우기는 휴지통으로만 보내요.
- **콘텐츠 보안 정책(CSP)**: 외부 스크립트를 불러오지 않고, 앱 창 안에서 다른 웹사이트로 이동하지 못해요. 링크는 기본 브라우저로 열어요(https만).
- **Electron 보안 퓨즈**: 설치된 앱을 다른 프로그램이 Node.js 실행기(`ELECTRON_RUN_AS_NODE`)나 코드 주입 통로(`NODE_OPTIONS`, `--inspect`)로 악용하지 못하게 막고, 앱 파일(`app.asar`)이 바뀌면 실행되지 않게 했어요. 설치된 앱에서는 개발자 도구도 열리지 않아요.
- **권한 우회 없음**: Claude Code의 권한 확인을 끄는 옵션(`--dangerously-skip-permissions`)을 쓰지 않아요.
- **대화 내용은 글자로만**: Claude의 답변과 미리보기는 HTML로 해석하지 않거나, 스크립트가 꺼진 격리 창(sandbox iframe)에서만 보여 줘요.
- **공급망**: 앱에 들어가는 라이브러리는 빌드할 때마다 알려진 취약점을 검사하고(높음 이상이면 빌드 중단), 빌드에 쓰는 GitHub Actions는 커밋 단위로 고정해요.

## 6. 보안 문제 신고

보안 문제를 발견하면 공개 이슈 대신 저장소의 **Security → Report a vulnerability**(비공개 신고)로 알려 주세요. 이 기능은 저장소 관리자가 **Settings → Security → Private vulnerability reporting**에서 켜야 해요.
