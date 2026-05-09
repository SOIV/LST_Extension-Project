# LST Project Documentation (V3)

> Live Stream Translator (LST) project documents

이 디렉토리(`docs/LST-PJ_V3/`)에 포함된 모든 문서(`*.md`), 하위 폴더 및 그 내부 파일은
이 폴더 내부의 [LICENSE](LICENSE)에 명시된 별도 라이선스를 따릅니다.

루트 디렉토리의 `LICENSE`는 이 폴더 및 하위 구성요소에는 적용되지 않습니다.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

## Document Entry Points

- 전체 문서 인덱스: [INDEX.md](INDEX.md)
- 공개 수준 분류표: [_classification.md](_classification.md)
- 전체 개요/로드맵: `public/00_core/`
- Chrome Extension: `public/10_extension/`
- Web Platform: `public/20_platform/`
- Desktop App: `public/30_desktop-app/`
- 공통 시스템: `public/40_shared-systems/`
- 전략 문서: `public/50_strategy/`
- 아이디어/실험: `planning/90_ideas/`
- 아카이브: `99_archive/`

## Structure Policy

제품별로 먼저 찾고, 여러 제품에 걸치는 내용은 `public/40_shared-systems/`에서 관리합니다.

- Extension의 커뮤니티 자막/Web Speech STT/Whisper API STT: `public/10_extension/`
- 플랫폼의 업로드/편집/승인: `public/20_platform/`
- Desktop App의 Lite Helper/Full App/오디오 캡처/STT runtime: `public/30_desktop-app/`
- STT 엔진 선택, 자막 포맷, 번역 파이프라인: `public/40_shared-systems/`

## Publication Policy

이 폴더의 문서는 공개 레포에 존재하지만, 모든 문서가 사용자용 공개 문서는 아닙니다.
문서별 공개 수준은 [_classification.md](_classification.md)를 기준으로 관리합니다.

- `public`: 사용자 문서 또는 개발자 문서로 승격 가능
- `planning`: 초안/아이디어/로드맵
- `sensitive-draft`: 사업/가격/펀딩/외주 등 공개 정책으로 오해될 수 있는 문서

## License

이 폴더 문서의 라이선스는 동일 디렉토리의 [LICENSE](LICENSE)를 확인해 주세요.
