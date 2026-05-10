# Subtitle Format System

Status: planned

여러 제품에서 공통으로 사용하는 자막 포맷 처리 기준을 다룬다.
목표는 SRT, VTT, SMI/SAMI, TTML을 그대로 구현 세부에 흩뿌리지 않고, LST 내부 공통 모델로 정규화한 뒤 필요한 포맷으로 다시 직렬화하는 것이다.

## Scope

- SRT
- VTT
- SMI/SAMI
- TTML
- 포맷 감지
- 파싱/직렬화
- 포맷별 표시 제약
- 변환 시 손실 가능성 표시

## Internal Cue Model

LST 내부에서는 포맷과 무관하게 아래 구조를 기준으로 자막을 다룬다.

| Field | Required | Notes |
|---|---:|---|
| `id` | no | 원본 cue id 또는 내부 생성 id |
| `startMs` | yes | 시작 시간, millisecond 기준 |
| `endMs` | yes | 종료 시간, millisecond 기준 |
| `text` | yes | 표시 텍스트. 기본값은 plain text |
| `language` | no | BCP 47 tag 권장. 예: `ko`, `ja`, `en-US` |
| `speaker` | no | 화자 정보. diarization 또는 수동 입력 결과 |
| `style` | no | 굵기, 기울임, 색상 등 제한적 스타일 |
| `position` | no | 위치/정렬 정보. 지원 포맷에서만 보존 |
| `metadata` | no | 원본 포맷, 업로더, revision 등 부가 정보 |

기본 렌더링 경로는 `startMs`, `endMs`, `text`만으로 동작해야 한다.
`speaker`, `style`, `position`은 지원 가능한 UI와 포맷에서만 보존한다.

## Format Support

| Format | Parse | Serialize | Notes |
|---|---:|---:|---|
| SRT | yes | yes | 기본 타임라인 자막. 스타일/위치 보존 제한 |
| VTT | yes | yes | Web/YouTube 미리보기와 Extension 표시 후보 |
| SMI/SAMI | planned | planned | HTML 유사 구조. 언어/스타일 해석 정책 필요 |
| TTML | planned | planned | 구조와 스타일이 복잡하므로 subset 우선 |

## Conversion Policy

- 모든 시간 값은 내부에서 millisecond로 정규화한다.
- 줄바꿈은 보존하되, 렌더러에서 표시 줄 수 제한을 별도로 적용할 수 있다.
- HTML/markup 입력은 기본적으로 plain text로 정규화한다.
- 허용된 ruby/스타일 마크업은 별도 whitelist 경로에서만 유지한다.
- 포맷 변환 중 손실된 정보는 가능하면 `metadata.losses`에 기록한다.
- 변환 결과가 원본과 의미상 달라질 수 있으면 UI에서 경고할 수 있도록 loss flag를 남긴다.

## Loss Examples

| Source | Target | Possible Loss |
|---|---|---|
| VTT | SRT | cue id, position, 일부 style |
| SMI/SAMI | SRT | class 기반 style, 언어별 sync grouping |
| TTML | SRT | region, style, nested span |
| ASS/advanced style | VTT/SRT | animation, karaoke timing, complex positioning |

## Validation Rules

- `startMs`는 `endMs`보다 작아야 한다.
- 음수 시간은 허용하지 않는다.
- 겹치는 cue는 허용하되, editor/renderer에서 경고할 수 있어야 한다.
- 빈 텍스트 cue는 기본적으로 제거 후보로 표시한다.
- 너무 긴 cue는 Subtitle Display 정책의 segmentation 기준에 따라 경고한다.

## Product Usage

| Product | Usage |
|---|---|
| Platform Upload | 업로드 포맷 감지, 내부 cue model 변환, revision 저장 |
| Platform Editor | 내부 cue model을 기준으로 편집 후 저장 |
| Extension | Platform API가 제공한 cue model 또는 VTT/SRT를 렌더링 |
| Desktop App | batch STT/번역 결과를 cue model로 생성 후 내보내기 |

## Related Documents

- [Subtitle Display](subtitle-display.md)
- [Platform Subtitle Editor](../20_platform/subtitle-editor.md)
- [Extension Community Subtitles](../10_extension/community-subtitles.md)
