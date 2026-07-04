# 자막 리비전 및 롤백 정책

## 개요

LST Project 플랫폼의 자막은 편집할 때마다 새 리비전(버전)이 생성됩니다. 기존 리비전은 삭제되지 않으며 언제든지 이력을 조회하거나 이전 버전으로 복원할 수 있습니다.

---

## 리비전 생성 규칙

- **편집 저장 시마다 새 리비전 생성**: 편집기에서 저장할 때 기존 파일을 수정하지 않고 새 리비전(`revision_number` 순번 증가)을 만들어 저장합니다.
- **is_current 플래그**: 트랙당 하나의 리비전만 `is_current = true`로 표시됩니다. 이 버전이 시청자에게 제공되고 YouTube에 업로드될 때 사용됩니다.
- **불변성**: 한 번 저장된 리비전 파일은 수정할 수 없습니다. 변경 사항은 항상 새 리비전으로 기록됩니다.
- **저장 용량 제한**: 리비전당 최대 4MB.

---

## 리비전 번호 부여 방식

- 트랙(언어)별로 독립적인 순번 관리 (`1, 2, 3, ...`)
- 첫 자막 생성 시 `revision_number = 1`
- 이후 저장마다 +1 증가
- 동시 저장 충돌 시 재시도 로직으로 번호 중복 방지

---

## diff 비교 (버전 간 변경 내역 확인)

리비전 히스토리 모달에서 과거 리비전의 **비교(Compare)** 버튼을 클릭하면 해당 버전과 현재 버전 간의 line-by-line diff를 확인할 수 있습니다.

- **비교 방향**: 선택한 과거 버전 → 현재 버전
- **diff 표시**: 추가된 줄(+, 녹색), 삭제된 줄(−, 빨강), 변경 없는 줄로 구분
- **API**: `GET /api/tracks/{trackId}/revisions/diff?from={revisionId}&to={revisionId}`

---

## 복원(롤백) 정책

### 복원 가능 조건

| 조건 | 복원 가능 여부 |
|------|---------------|
| 자막 생성자(creator_id) | ✅ |
| 관리자(admin role) | ✅ |
| 채널 소유자(승인된 트랙) | ✅ |
| 일반 로그인 사용자 | ❌ |
| 비로그인 사용자 | ❌ |

### 복원 동작

- **복원 시 새 리비전이 생성됩니다**: 나무위키의 "v2으로 되돌림" 방식과 동일하게, 복원 대상 버전의 내용을 새 리비전으로 저장합니다.
  - 예: v1, v2, v3이 있고 v1으로 복원 → `v4 (v1으로 되돌림)` 생성
- **복원 메시지**: 자동으로 `"v{N}으로 되돌림"` 형식의 메시지가 기록됩니다.
- **히스토리 완전 보존**: 복원 전후의 모든 리비전이 히스토리에 남아 누구나 변경 이력 전체를 확인할 수 있습니다.
- **원자적 처리**: `update_current_revision` DB 함수로 is_current 전환을 원자적으로 수행하여 동시성 문제를 방지합니다.
- **API**: `POST /api/tracks/{trackId}/revisions/{revisionId}/restore`

### 복원 후 상태

예시:

```
v4  ← current  "v1으로 되돌림"
v3              (이전 최신 편집)
v2
v1              (복원 원본)
```

- 새로 생성된 리비전(v4)이 `is_current = true`가 됩니다.
- 시청자에게는 새 리비전의 자막이 제공됩니다.
- 트랙 상태(`draft`, `pending`, `approved`, `rejected`)는 변경되지 않습니다.
- 이미 YouTube에 업로드된 자막은 별도 재업로드가 필요합니다.

---

## 데이터 보관 정책

- 리비전은 **영구 보관**합니다. 자동 삭제 없음.
- R2 스토리지에 불변 파일로 저장됩니다.
- 향후 용량 관리 정책이 필요한 경우 별도 아카이브 정책을 수립합니다.

---

## 관련 파일

- DB 스키마: `docs/local/supabase_migrations/Initial Schema.sql` (`subtitle_revisions` 테이블)
- RPC 함수: `docs/local/supabase_migrations/rls.sql` (`update_current_revision`)
- 복원 API: `platform/src/app/api/tracks/[trackId]/revisions/[revisionId]/restore/route.ts`
- diff API: `platform/src/app/api/tracks/[trackId]/revisions/diff/route.ts`
- UI 컴포넌트: `platform/src/components/RevisionHistoryModal.tsx`
