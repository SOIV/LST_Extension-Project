---
sidebar_position: 2
---

# API 키 설정

API 키는 확장 팝업의 **연동** 탭에서 입력합니다. 입력한 키는 브라우저 로컬 저장소에 저장되며, Chrome 계정 동기화 저장소에는 저장하지 않습니다.

커뮤니티 자막 기능은 API 키 없이 사용할 수 있습니다. API 키는 실시간 STT와 번역 엔진 사용 시에만 필요합니다.

## 어떤 키가 필요한가요?

| 기능 | 서비스 | 무료 사용 | 키 필요 |
|---|---|---|---|
| 실시간 STT (탭 오디오) | OpenAI API | 신규 크레딧 또는 소액 비용 | 필요 |
| 실시간 STT (마이크) | Web Speech API | 무료/무제한 | 불필요 |
| 번역 (기본) | Google Translate | 무료 | 불필요 |
| 번역 | Google Apps Script | 무료 (설정 필요) | Apps Script URL |
| 번역 | Naver Papago | 제한적 무료 | 키 필요 |
| 번역 | DeepL | 월 500,000자 무료 | 키 필요 |

---

## OpenAI API 키

탭 오디오 캡처 기반 STT(Whisper, Realtime)에 사용합니다. 마이크 모드(Web Speech API)에서는 필요하지 않습니다.

### 발급 방법

1. [platform.openai.com](https://platform.openai.com) 에서 계정을 만들거나 로그인합니다.
2. 왼쪽 메뉴에서 **API keys**를 클릭합니다.
3. **+ Create new secret key** 버튼을 클릭합니다.
4. 이름을 입력하고 **Create secret key**를 클릭합니다.
5. 생성된 키(`sk-proj-...` 형태)를 복사합니다. 이 창을 닫으면 다시 볼 수 없습니다.
6. 확장 팝업 → **연동** 탭 → **OpenAI API 키** 항목에 붙여 넣습니다.

### 비용

| 모델 | 용도 | 참고 비용 |
|---|---|---|
| `gpt-4o-mini-transcribe` | Whisper STT (기본값) | ~$0.003/분 |
| `gpt-4o-transcribe` | Whisper STT (고품질) | ~$0.006/분 |
| Realtime 모델 | Realtime STT | Realtime API 요금 기준 |

최신 가격은 [OpenAI 요금 페이지](https://openai.com/api/pricing)에서 확인하세요.

### 사용량 제어

OpenAI 대시보드의 **Settings → Limits**에서 월별 사용 한도를 설정할 수 있습니다. 예상치 못한 과금을 방지하려면 한도를 먼저 설정해 두는 것을 권장합니다.

---

## DeepL API 키

DeepL은 **Free 플랜으로 월 500,000자까지 무료**로 사용할 수 있습니다.

### 발급 방법

1. [deepl.com/pro-api](https://www.deepl.com/ko/pro-api) 에서 **무료로 가입**을 클릭합니다.
2. 이메일 또는 Google/Apple 계정으로 가입합니다.
3. 가입 후 **계정 → API 키** 메뉴에서 발급된 키를 복사합니다.
4. 확장 팝업 → **연동** 탭 → **DeepL API 키** 항목에 붙여 넣습니다.

### Free vs Pro 키 구분

Free 플랜 키는 끝에 `:fx`가 붙어 있습니다 (예: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx`). 확장 프로그램은 키 형태를 보고 자동으로 Free/Pro 엔드포인트를 선택하므로 별도 설정이 필요하지 않습니다.

| 플랜 | 월 할당량 | 키 형태 |
|---|---|---|
| Free | 500,000자 | `....:fx` |
| Pro | 무제한 (사용량 과금) | `:fx` 없음 |

---

## Papago (Naver Cloud Platform) 키

Naver Cloud Platform(NCP)에서 발급합니다. 한국어·일본어·영어 번역 품질이 높습니다.

### 발급 방법

1. [ncloud.com](https://www.ncloud.com) 에서 계정을 만들거나 네이버 계정으로 로그인합니다.
2. 콘솔 상단 메뉴에서 **Services → AI Services → Papago Translation**을 클릭합니다.
3. **이용 신청**을 진행합니다.
4. 신청 후 **Application 등록**에서 새 앱을 만들고 Papago Translation 서비스를 선택합니다.
5. 앱 목록에서 생성된 앱을 클릭하면 **Client ID**와 **Client Secret**이 표시됩니다.
6. 확장 팝업 → **연동** 탭에서:
   - **Papago Client ID**: Client ID 입력
   - **Papago Client Secret**: Client Secret 입력

:::note
NCP는 신규 가입 시 크레딧을 제공하며, Papago Translation의 무료 할당량은 [NCP 요금 안내](https://www.ncloud.com/product/aiService/papagoTranslation)에서 확인하세요. 서비스 UI와 메뉴 명칭은 변경될 수 있습니다.
:::

---

## Google Apps Script URL

Google 계정으로 Apps Script를 배포하면 Google Translate API를 **무료**로 사용할 수 있는 프록시를 만들 수 있습니다. 기본 Google 번역 엔진보다 안정적입니다.

### 배포 방법

1. [script.google.com](https://script.google.com) 에서 **새 프로젝트**를 만듭니다.
2. 편집기에 아래 코드를 붙여 넣습니다.

```javascript
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const translated = LanguageApp.translate(
    body.text,
    body.source === 'auto' ? '' : body.source,
    body.target
  );
  return ContentService.createTextOutput(
    JSON.stringify({ translatedText: translated })
  ).setMimeType(ContentService.MimeType.JSON);
}
```

3. 상단 메뉴 **배포 → 새 배포**를 클릭합니다.
4. 유형에서 **웹 앱**을 선택합니다.
5. 설정:
   - **다음 사용자로 실행**: 나 (나의 Google 계정)
   - **앱에 액세스할 수 있는 사용자**: 모든 사용자
6. **배포**를 클릭하고 권한을 허용합니다.
7. 배포 URL(`https://script.google.com/macros/s/.../exec` 형태)을 복사합니다.
8. 확장 팝업 → **연동** 탭 → **Apps Script 배포 ID 또는 URL** 항목에 붙여 넣습니다.

:::tip
배포 URL 전체 또는 배포 ID(`AKfycb...` 부분)만 입력해도 됩니다.
:::

---

## 기본 Google Translate

별도 키 없이 바로 사용할 수 있는 기본 번역 엔진입니다. **연동 탭에서 별도 설정이 필요하지 않습니다.** 실시간 탭의 번역 엔진 선택에서 `Google Translate (무료)`을 선택하면 됩니다.

다른 엔진이 실패할 경우 자동 fallback으로도 사용됩니다.
