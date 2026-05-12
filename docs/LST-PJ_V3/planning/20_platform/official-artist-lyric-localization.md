# 공식 아티스트 음악 영상 다국어 가사 자막 기능 초안

## 1. 문서 목적

이 문서는 LST 플랫폼이 성장한 이후 검토할 수 있는 **공식 아티스트 채널 전용 다국어 가사 자막 기능**의 초기 아이디어를 정리한다.

본 기능은 YouTube Content ID와 같은 권리 식별 시스템을 직접 구현하는 것이 아니라, 공식 아티스트 채널의 공식 음악 영상을 대상으로 가사 자막 작업 권한과 게시 흐름을 제공하는 **파트너/크리에이터 기능**으로 취급한다.

---

## 2. 기본 방향

### 2.1 기능 성격

- 초기 MVP 기능이 아님
- 플랫폼 사용량과 크리에이터/아티스트 채널 참여가 충분해진 이후 검토
- 일반 커뮤니티 자막 기능과 별도의 권한 및 검수 체계를 사용
- 공식 가사 제공자, 채널 관리자, 승인된 작업자, 플랫폼 운영 정책이 함께 필요한 기능

### 2.2 목표

- 공식 아티스트 채널의 공식 음악 영상에 한해 다국어 가사 자막을 사전 제작할 수 있게 한다.
- 채널 관리자가 허용한 언어에 대해서만 번역/싱크 작업을 진행하게 한다.
- 공식 가사 제공자 또는 검증된 원문 가사를 기준 데이터로 사용한다.
- 가사 제공자에 데이터가 없을 경우, 채널 관리자가 직접 제공한 가사를 공식 원문으로 취급한다.
- 승인된 작업물만 Extension 또는 플랫폼 자막 표시 기능에서 노출한다.

---

## 3. 범위 구분

### 3.1 하는 것

- 공식 아티스트 채널 또는 레이블/배급사 채널 식별
- 공식 음악 영상 여부 확인
- 공식 원문 가사 연결 또는 채널 관리자 제공 원문 가사 등록
- 채널 관리자 제공 원문 가사는 별도 플랫폼 검증 없이 즉시 승인 처리
- 채널 관리자의 대상 언어 허용 목록 설정
- 작업자 초대 및 역할 부여
- 원문 가사 타임스탬프 작업 상태 관리
- 언어별 다국어 가사 자막 작업 상태 관리
- 리뷰/승인 후 공개 또는 예약 게시

### 3.2 하지 않는 것

- Content ID 수준의 오디오 핑거프린팅
- 권리자 분쟁 처리 시스템
- 공식 가사 라이선스 계약 자동화
- 모든 YouTube 음악 영상에 대한 자동 판별
- 채널 관리자가 허용하지 않은 언어의 임의 번역 공개

---

## 4. 주요 사용자 역할

| 역할 | 설명 |
|---|---|
| Channel Admin | 공식 아티스트/레이블 채널 관리자 |
| Project Manager | 채널 관리자가 지정한 작업 관리 담당자 |
| Subtitle Worker | 가사 번역과 타임스탬프 싱크를 함께 작업하는 자막 작업자 |
| Reviewer | 번역/싱크 검수자 |
| Platform Admin | 플랫폼 운영자 |

초기 설계에서는 Channel Admin과 Platform Admin을 명확히 분리한다. 채널 관리자는 본인 채널의 작업을 관리하지만, 플랫폼 전체 정책이나 타 채널 작업에는 개입하지 않는다.

Translator와 Sync Editor를 기본 역할로 분리하지 않는다. 실제 작업에서는 한 명의 작업자가 번역과 타임스탬프를 함께 처리하는 경우가 많기 때문에, 기본 역할은 Subtitle Worker로 둔다. 대형 파트너 또는 외주 작업에서 분업이 필요할 경우에만 세부 권한을 선택적으로 추가한다.

---

## 5. 기본 워크플로우

```text
채널 관리자 인증
  ↓
공식 음악 영상 등록 또는 연결
  ↓
가사 제공자 조회 또는 채널 관리자 원문 가사 제공
  ↓
원문 가사 승인
  ↓
원문 타임스탬프 작업
  ↓
대상 언어 허용 목록 설정
  ↓
작업자 초대 또는 지정
  ↓
언어별 다국어 가사 자막 작업
  ↓
리뷰 및 수정 요청
  ↓
승인
  ↓
공식 영상 공개 시점에 맞춰 게시 또는 예약 게시
```

---

## 6. 원문 가사 제공 및 타임스탬프 선행 조건

공식 가사는 다음 순서로 확보한다.

1. 공식 가사 제공자 API에서 해당 곡의 가사를 조회한다.
2. 제공자 데이터가 없을 경우, 채널 관리자가 직접 원문 가사를 제공할 수 있다.
3. 채널 관리자가 제공한 가사는 해당 채널의 공식 자료로 간주하고 별도 검증 없이 즉시 승인 처리한다.

단, 즉시 승인 처리는 "플랫폼이 다시 사실 검증하지 않는다"는 의미이며, 추적 가능성을 위해 제공자, 제공 시각, 제공 계정, 연결된 영상/곡 정보는 기록한다.

다국어 작업은 원문 가사 타임스탬프가 준비된 이후에만 시작한다.

```ts
type SourceLyricsState = {
  provider:
    | "missing"
    | "licensed_provider"
    | "label_supplied"
    | "artist_supplied"
    | "manual_verified";
  approvalStatus: "missing" | "approved";
  timingStatus: "not_started" | "in_progress" | "completed";
};
```

```ts
const canStartLocalizedLyricsWork =
  sourceLyrics.approvalStatus === "approved" &&
  sourceLyrics.timingStatus === "completed";
```

---

## 7. 언어 허용 정책

채널 관리자는 영상별 또는 곡별로 작업 가능한 언어를 미리 지정한다.

```ts
type TargetLanguagePolicy = {
  language: string;
  enabled: boolean;
  status:
    | "not_started"
    | "in_progress"
    | "submitted"
    | "needs_revision"
    | "approved"
    | "scheduled"
    | "published";
  assignedTo?: string[];
};
```

표시 조건은 보수적으로 둔다.

```ts
const canShowLocalizedLyrics =
  isOfficialArtistMusicVideo &&
  hasApprovedSourceLyrics &&
  hasCompletedSourceTiming &&
  targetLanguage.status === "published";
```

---

## 8. 적용 가능한 영상 유형

이 기능은 공식 MV만 대상으로 제한하지 않는다. 곡의 공식 가사와 연결할 수 있고, 채널 관리자가 권한을 가진 공식 음악 영상이라면 확장 가능하다.

| 유형 | 설명 |
|---|---|
| Official MV | 정식 뮤직비디오 |
| Official Live Performance | 방송/공연/스튜디오 라이브 등 공식 라이브 영상 |
| Official Lyric Video | 공식 리릭 비디오 |
| Official Audio | 공식 오디오 영상 |
| Concert Clip | 공연 일부 클립. 세트리스트와 곡 매칭이 필요함 |

라이브 공연 영상은 스튜디오 음원과 가사 반복, 애드리브, 관객 호응, 편곡 구조가 다를 수 있으므로 원곡 가사를 그대로 붙이는 방식만으로는 부족할 수 있다. 이 경우 곡 단위 원문 가사를 기준으로 하되, 실제 공연 버전에 맞춘 생략/반복/애드리브 구간 표시 정책이 추가로 필요하다.

---

## 9. 일부 공개 작업 공간

공식 영상 공개 전 사전 작업을 위해 일부 공개 또는 초대 기반 작업 공간을 제공할 수 있다.

```ts
type LyricWorkspaceVisibility =
  | "private"
  | "unlisted_invite_link"
  | "organization_only";
```

### 고려 사항

- 초대 링크는 만료 시간과 권한 범위를 가져야 한다.
- 링크만으로 최종 게시 권한을 부여하지 않는다.
- 작업자는 지정된 영상/언어 범위 안에서만 작업한다.
- 공개 전 영상 또는 가사 정보가 노출될 수 있으므로 접근 로그를 남긴다.

---

## 10. 데이터 모델 초안

```ts
type ChannelTier =
  | "standard"
  | "verified_artist"
  | "label_partner";

type ArtistLyricLocalizationProject = {
  projectId: string;
  channelId: string;
  videoId: string;
  contentType:
    | "official_mv"
    | "official_live_performance"
    | "official_lyric_video"
    | "official_audio"
    | "concert_clip";
  trackId?: string;
  channelTier: ChannelTier;
  sourceLyrics: SourceLyricsState;
  sourceLanguage: string;
  targetLanguages: TargetLanguagePolicy[];
  visibility: LyricWorkspaceVisibility;
  publishPolicy: {
    mode: "hold_until_video_public" | "publish_immediately" | "schedule_at";
    scheduledAt?: string;
  };
};
```

---

## 11. 운영 및 법적 리스크

이 기능은 가사 저작권, 번역권, 채널 권한, 공식 가사 제공자 약관의 영향을 받는다.

따라서 실제 구현 전에는 다음 조건이 필요하다.

- 공식 가사 제공자 또는 권리자 제공 원문 가사 사용 근거
- 채널 관리자 제공 원문 가사의 기록 및 책임 범위
- 번역 가사 표시 권한 범위 확인
- 채널 관리자 인증 방식 확정
- 작업자 NDA 또는 비공개 자료 접근 정책 검토
- 게시 전 리뷰/승인 책임 주체 정의
- 문제가 발생했을 때 작업물 비공개 전환 및 이의제기 절차 마련

---

## 12. MVP와의 관계

본 기능은 현재 MVP 범위에 포함하지 않는다.

초기 단계에서는 다음 정도의 확장점만 고려한다.

- 채널 소유자 인증 구조를 너무 좁게 만들지 않기
- 자막/가사 데이터에 draft, approved, published 같은 상태값을 둘 수 있게 하기
- 원문 가사 타임스탬프 완료 후 다국어 작업이 열리는 구조를 고려하기
- 영상 ID 기준 작업물과 사용자 개인 설정을 분리하기
- 기능 노출을 feature flag로 제어할 수 있게 하기

---

## 13. 도입 조건

다음 조건이 충족될 때 재검토한다.

- 플랫폼의 일반 자막 업로드/조회/편집 흐름이 안정화됨
- Extension 사용량과 플랫폼 트래픽이 충분함
- 공식 채널 또는 레이블 파트너 수요가 확인됨
- 가사 제공자 또는 권리자 제공 데이터 사용 가능성이 생김
- 운영진이 검수/문의/권한 문제를 처리할 수 있는 상태임

---

## 14. 정리

공식 아티스트 음악 영상 다국어 가사 자막 기능은 LST의 장기 성장 기능이다.

초기에는 일반 커뮤니티 자막 플랫폼과 크리에이터 업로드 흐름을 우선 완성하고, 본 문서는 이후 공식 채널 파트너 기능을 설계할 때 꺼내 쓰는 초안으로 유지한다.
