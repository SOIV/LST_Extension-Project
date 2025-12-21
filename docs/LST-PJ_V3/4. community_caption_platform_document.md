# Community Caption Platform — Concept & Architecture Idea

이 문서는 **유튜브 영상 기반 커뮤니티 자막 플랫폼**을 구현하기 위한 전체 아이디어를 정리한 문서입니다.
크롬 확장 프로그램, Desktop App, Lite Helper App, 웹 포털이 상호 협력하여 동작하는 구조를 목표로 합니다.

---

## 🎯 1. 프로젝트 핵심 목표
- **유저가 만든 자막을 업로드/관리하는 웹 플랫폼 제공**
- 크롬 확장 프로그램이 영상 URL 기반으로 **자동으로 커뮤니티 자막을 불러와 적용**
- Desktop App/Lite Helper와 연동해 **AI 기반 자동 싱크/자동 번역/품질 개선** 제공
- 실시간 방송(Premieres, Live)에까지 적용 가능한 **실시간 자막 시스템 구축**

---

## 🧩 2. 전체 시스템 구성
```
User → Chrome Extension
       ↓ videoId 요청
Web Caption Platform (API/DB)
       ↓ 자막 파일 제공
Lite Helper / Desktop App (선택)
       ↓ Whisper/AI 기반 정교 처리
Chrome Extension에서 최종 자막 Overlay 출력
```

---

## 🟥 3. 웹 플랫폼 기능
### 3.1 자막 업로드 기능
- SRT/VTT/SBV/SMI/TXT 등 모든 자막 포맷 지원
- 영상 URL 입력 → videoId 자동 추출
- 언어/버전/설명/태그 입력 가능
- 자동 포맷 변환 기능 (예: SRT → VTT)

### 3.2 자막 조회 기능
- videoId 기반 검색
- 언어별 필터
- 최신 버전 자동 선택
- 추천순/다운로드순 정렬 옵션

### 3.3 자막 수정 기능
- 웹 에디터에서 텍스트 바로 수정
- 타임코드 수정 UI 제공
- 자동 싱크 조정(Whisper 기반)
- AI 자연스러운 문장 개선 옵션

### 3.4 자막 버전 관리
- Git처럼 diff 비교
- 이전 버전 복원
- 기여자 목록 기록

### 3.5 사용자 시스템
- Google OAuth 로그인
- 업로드한 자막 관리
- 기여 내역 및 신뢰도 점수
- 크리에이터 관리 센터(영상 내 자막 관리 및 업로드 등)
   - 본인 채널 영상 목록 조회
   - 플랫폼 자막을 YouTube API로 업로드
   - 별도의 승인/검수 권한 없음

---

## 🟦 4. Chrome Extension 기능
### 4.1 자동 자막 불러오기
- 영상 URL에서 videoId 추출
- API 서버에 videoId로 자막 조회
- 존재하면 즉시 Overlay 표시

### 4.2 자막 동기화 보정
- Lite Helper와 연결해 offset 자동 조정
- 영상 속 음성을 5~10초 분석하여 싱크 재계산

### 4.3 실시간 감지
- 라이브 스트리밍 지연 변경 감지
- Premieres 카운트다운 감지

---

## 🟩 5. Lite Helper App
브라우저의 한계(FFmpeg/Whisper 실행 불가)를 보완하는 **보조 프로그램**.

### 핵심 기능
- 로컬 Whisper 실행
- 자동 싱크 계산
- 자막 파일 변환(SRT↔VTT)
- 클라우드 자막 캐시
- 브라우저와 WebSocket 통신

### 확장 프로그램이 Lite Helper를 선택적으로 사용할 상황
- 긴 영상 싱크 계산
- Whisper 기반 번역 생성
- 강력한 OCR 처리
   - OCR 종류: Win OCR, Tesseract, Snipping Tool OCR, Google(스냅샷 전용), Easy OCR

---

## 🟧 6. Desktop App (Full Version)
전문 자막 제작용 고급 기능 포함.

### 주요 기능
- Whisper로 전체 영상 자막 생성
- 고급 자막 편집 UI (Premiere Pro 스타일)
- AI 자동 번역
- 자막 렌더링/내보내기
- 커뮤니티 자막 업데이트/등록
- 계정 연동 및 기여도 관리

---

## 🟪 7. Backend & Storage 아키텍처
### 7.1 DB 구조(예시)
```
/videos/
   ASDF1234/
      subtitles/
         ko/
            v1.json
            v2.json
         en/
            v1.json
         ja/
            v1.json
      meta.json
```

### 7.2 Storage
- AWS S3 / Cloudflare R2 / Supabase Storage 중 하나
- 자막 파일은 대부분 텍스트기 때문에 비용 거의 없음

### 7.3 API 설계
- `GET /subtitles/{videoId}`
- `POST /subtitles/upload`
- `PATCH /subtitles/{id}`
- `GET /videos/{videoId}/meta`

---

## 🟫 8. AI 기능 통합 아이디어
- Whisper 기반 자동 자막 생성
- Whisper로 자동 싱크 재계산
- DeepL/ChatGPT 기반 자동 번역
- 품질 분석 모델(명확성/자연스러움/타임코드 정확도)
- 자막 문장 개선 AI (문장 자연화)

---

## 🔮 9. 확장 가능한 아이디어
- 커뮤니티 자막 추천 시스템
- 영상 장면 기반 자동 자막 스타일링
- 실시간 협업 자막 편집
- 브라우저 환경에서의 온라인 자막 스튜디오
- 여러 언어 자막을 동시에 표시하는 듀얼 자막 기능
- 사용자 설정 기반 자동 하이라이트(키워드 강조)

---

## 📌 결론
이 플랫폼은 단순 자막 도구가 아니라, **유튜브 공식 커뮤니티 자막 시스템을 업그레이드한 새로운 생태계**를 구성하는 것을 목표로 한다.

Chrome Extension + Lite Helper + Desktop App + Web 플랫폼의 조합으로 유저가 자막을 만들고, 관리하고, AI로 고도화할 수 있는 강력한 환경을 구축한다.

추후 구현 방향과 아이디어는 계속 확장 가능하다.

---

# 🔹 Web-based Editing & Review System

LST는 확장 프로그램 및 데스크탑 앱 외에도,
웹 사이트를 통해 번역 데이터의 **편집 · 검토 · 승인**을 수행할 수 있는 환경을 제공한다.

웹 편집 환경은 개인 작업뿐 아니라 **팀 단위 협업**을 고려하여 설계된다.

---

## 1. Web Editing Environment

### 1.1 Video Preview

* 웹 편집 화면에서는 **YouTube와 동일한 영상 재생 환경**을 제공한다.
* YouTube IFrame Player API를 기반으로 하며, 다음 기능을 포함한다:
  * 재생 / 일시정지
  * 시킹
  * 재생 속도 조절
* 자막은 YouTube 기본 자막이 아닌, **LST 서버에 저장된 자막 데이터를 오버레이 방식으로 표시**한다.

> 이를 통해 실제 시청 환경과 최대한 유사한 상태에서 자막을 미리 확인할 수 있다.

---

## 2. Subtitle Editing Views

LST는 자막 편집을 위해 **2가지 편집 뷰**를 제공한다.

### 2.1 Basic View (Timeline-based)

* 일반적인 자막 편집 방식
* 각 자막은 다음 정보를 가진다:
  * 시작 시간
  * 종료 시간
  * 표시 텍스트
* 대상:
  * 대부분의 번역 작업자
  * 자막 작업 입문자

이 뷰는 LST의 **기본 편집 방식**으로 제공된다.

---

### 2.2 Scripting View (Advanced)

* 고급 사용자를 위한 스크립트 기반 편집 뷰
* 조건부 표시, 스타일 제어, 화자 구분 등 **고급 자막 표현**을 지원한다.
* 내부적으로는 Basic View와 동일한 자막 데이터 구조를 사용하며,
  * Basic View ↔ Scripting View 간 전환이 가능하도록 설계된다.

> Scripting View는 초기에는 실험적(Beta) 기능으로 제공될 수 있다.

---

# 🔹 Translation Approval & Display Policy

## 3. Server-first Translation Storage

* 번역된 자막, 제목, 설명 데이터는 **기본적으로 LST 서버에만 저장**된다.
* 크리에이터(채널 소유자)가 승인하기 전까지는:
  * YouTube 채널에 업로드되지 않는다.

---

## 4. Approval-based Publishing

* 크리에이터는 웹 또는 클라이언트에서 다음을 수행할 수 있다:
  * 번역 데이터 미리보기
  * 승인 또는 거절
* 승인된 데이터만:
  * YouTube 자막 / 제목 / 설명란에 적용된다.

---

## 5. Client-only Display (Unapproved Data)

* 승인되지 않은 번역 데이터는:
  * LST 확장 프로그램
  * LST 데스크탑 앱에서만 표시된다.
* 이는 커뮤니티 번역을 가능하게 하면서도, 채널 소유자의 권한과 플랫폼 정책을 보호하기 위한 구조이다.

---

# 🔹 Source Subtitle Requirement (Quality Control)

## 6. Original Subtitle Requirement

* 번역 작업을 시작하기 위해서는 **원어 자막이 반드시 존재해야 한다**.
* 원어 자막은 다음 방식 중 하나로 생성될 수 있다:
  * 크리에이터 업로드
  * 커뮤니티 직접 작성
  * AI 자동 생성 (초안)

원어 자막은 다음 상태로 구분된다:

* Original (AI Generated)
* Original (Human Verified)

> 이 구조는 번역 품질 확보와 기준점(Source of Truth)을 제공하기 위한 일종의 방지턱 역할을 한다.

---

# 🔹 Channel-based Translation Teams

## 7. Translation Team System

* 각 YouTube 채널은 커뮤니티 기반 **번역 팀**을 등록할 수 있다.
* 초기 정책:
  * 채널당 최대 **2개의 팀** 등록 가능
  * (유사 공식 번역팀 개념)

---

## 8. Team Profile

각 팀은 공개 프로필을 가진다.

프로필에는 다음 정보가 포함될 수 있다:

* 팀 이름 및 설명
* 작업 언어
* 팀원 목록 및 역할
* 참여한 영상 목록
* 승인된 기여 내역

이는 팀 단위 번역의 **신뢰성과 투명성**을 높이기 위한 목적이다.

---

## 9. Team-level Reporting & Moderation

* 개인뿐 아니라 **팀 단위로도 신고**가 가능하다.
* 반복적인 문제 또는 악의적인 활동이 발생할 경우 다음과 같은 조치가 이루어질 수 있다.
  * 경고
  * 팀 활동 제한
  * 채널 연결 해제
  * 팀 비활성화
    

---

## 🔹 Design Philosophy (Optional Section)

> LST는 단순한 자막 업로더가 아닌,
> **번역 데이터의 생성 · 검증 · 승인 · 표시를 관리하는 협업 플랫폼**을 목표로 한다.