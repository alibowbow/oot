# 🎵 Ocarina of Time — 시간의 오카리나 웹앱

브라우저에서 바로 연주할 수 있는 **젤다의 전설: 시간의 오카리나** 오카리나 웹앱입니다.
마우스 · 터치 · 키보드로 하이랄의 명곡들을 직접 연주하고, 12곡 전곡의 **악보**(버튼 탭 + 오선보)를 함께 제공합니다.

A playable *Ocarina of Time* web app — perform the songs of Hyrule with mouse,
touch, or keyboard, complete with sheet music for all 12 melodies.

## ✨ 기능 (Features)

- 🎼 **오카리나 연주** — 5개의 음(A · ▼ · ▶ · ▲ · ◀)을 Web Audio API로 합성.
  사인파 + 비브라토 + 리버브로 실제 오카리나 같은 부드러운 음색을 구현했습니다.
- 🎨 **오카리나 이미지** — 파란 "시간의 오카리나"를 SVG로 그렸고, 음을 연주하면
  해당 구멍이 그 음의 색으로 빛납니다.
- 📜 **전곡 악보** — 12곡 모두 **버튼 탭(화살표)** 과 **오선보** 두 가지 방식으로 표기.
- ▶ **자동 연주(Play)** — 곡을 자동으로 연주하며 버튼/악보를 하이라이트.
- ✎ **연습 모드(Practice)** — 다음에 눌러야 할 버튼을 짚어주는 가이드 연습.
- ✨ **곡 인식** — 자유 연주 중 아는 멜로디를 치면 자동으로 알아맞힙니다
  ("♪ You played Saria's Song 사리아의 노래 ♪").

## ⌨️ 조작법 (Controls)

| 버튼 | 키보드 | 음 (Note) |
|------|--------|-----------|
| **A** | `A` 키 | D4 |
| **▼** C-down | `↓` | F4 |
| **▶** C-right | `→` | A4 |
| **▲** C-up | `↑` | B4 |
| **◀** C-left | `←` | D5 |

## 🗺️ 수록곡 (Songs)

**기본 오카리나 곡** — 젤다의 자장가 · 에포나의 노래 · 사리아의 노래 ·
태양의 노래 · 시간의 노래 · 폭풍의 노래

**워프 곡** — 숲의 미뉴에트 · 불의 볼레로 · 물의 세레나데 ·
영혼의 레퀴엠 · 그림자의 녹턴 · 빛의 전주곡

각 곡의 버튼 순서는 원작 게임과 동일합니다.

## ▶ 실행 방법 (How to run)

별도의 빌드나 설치가 필요 없습니다. `index.html`을 브라우저에서 열기만 하면 됩니다:

```bash
# 그냥 파일 열기
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows

# 또는 간단한 로컬 서버로
python3 -m http.server 8000   # http://localhost:8000
```

> 소리는 브라우저 정책상 **첫 클릭/키 입력 이후** 재생됩니다.

## 📁 구조 (Project structure)

```
index.html          # 마크업 + 인라인 오카리나 SVG
assets/style.css    # 야간 하이랄 테마 스타일
assets/songs.js     # 음/곡 데이터 (버튼 시퀀스, 주파수)
assets/ocarina.js   # 오디오 합성 + 상호작용 + 악보 렌더링
```

## 📝 라이선스 / 저작권

본 프로젝트는 팬이 제작한 비상업적 헌정 작품입니다.
*The Legend of Zelda: Ocarina of Time* 및 관련 명칭·음악의 저작권은
**Nintendo**에 있습니다.
