# Release & Review Checklist

Status: planned

LST의 공개 배포, Chrome Web Store 심사, YouTube API/OAuth 검증, 개인정보/보안 정책을 배포 전에 확인하기 위한 체크리스트다.

## Chrome Extension

- [ ] Manifest V3 권한 목록 최종 검토
- [ ] host permissions 범위 최소화
- [ ] `activeTab`, `storage`, `scripting`, `offscreen` 등 권한 사용 사유 정리
- [ ] Chrome Web Store 설명, 스크린샷, 카테고리 준비
- [ ] 개인정보 처리방침 URL 준비
- [ ] API key 또는 토큰이 빌드 산출물에 포함되지 않는지 확인
- [ ] sourcemap 포함 여부와 배포 산출물 크기 확인

## YouTube / Google OAuth

- [ ] OAuth scope 목록과 사용 목적 정리
- [ ] `youtube.force-ssl` 등 민감 scope 사용 시 데모 영상 준비
- [ ] 크리에이터 채널 연동/해제 흐름 검증
- [ ] 승인/거절/업로드 실패 경로 검증
- [ ] Data access status와 OAuth consent screen 문구 확인

## Platform

- [ ] Supabase RLS 정책 점검
- [ ] 업로드 파일 크기/포맷 제한 확인
- [ ] Cloudflare R2 또는 storage bucket 공개 범위 확인
- [ ] 자막 조회 API rate limit 또는 abuse 대응 기준 확인
- [ ] 계정 삭제/데이터 삭제 요청 처리 경로 확인
- [ ] 오류 응답 형식과 사용자 메시지 점검

## Privacy & Security

- [ ] 수집하는 사용자 데이터 목록 정리
- [ ] 저장되는 자막/메타데이터/로그 범위 정리
- [ ] 사용자 API 키 저장 위치와 암호화 정책 확인
- [ ] telemetry 또는 analytics 사용 시 opt-in/opt-out 정책 확인
- [ ] 민감 문서(`sensitive-draft`)가 커밋/배포 산출물에 포함되지 않는지 확인

## Realtime STT / Translation

- [ ] Web Speech API fallback 동작 확인
- [ ] OpenAI Realtime STT 경로와 사용자 API 키 경로 구분
- [ ] OpenAI Realtime Translate 경로의 input transcription model과 translation model 구분
- [ ] provider별 timeout/retry/fallback 기준 확인
- [ ] 비용 발생 경로에 대한 사용자 안내 확인

## Manual QA

- [ ] YouTube 일반 영상
- [ ] YouTube Live
- [ ] YouTube SPA 페이지 이동
- [ ] 전체화면/theater mode
- [ ] 자막 없음/자막 있음/여러 언어 자막
- [ ] Extension on/off toggle
- [ ] 로그인/비로그인 상태
- [ ] 네트워크 오류와 API 무응답

## Release Gate

배포 전에는 다음 조건을 만족해야 한다.

- [ ] 핵심 플로우 수동 QA 완료
- [ ] 공개 문서와 실제 기능 범위 불일치 없음
- [ ] 개인정보 처리방침과 권한 설명 최신화
- [ ] 민감 초안이 공개 docs 사이트 또는 커밋 대상에 포함되지 않음
- [ ] rollback 또는 hotfix 경로 확인
