# LST STT 벤치마크

로드맵 P6 검증 항목인 **언어별 정확도/지연 비교**를 위한 도구입니다.
익스텐션이 실제로 보내는 것과 같은 요청으로 STT 엔진을 돌리고, 정답 자막과 비교해 CER과 지연을 표로 만듭니다.

| 엔진 스펙 | 대응하는 익스텐션 경로 | 비고 |
|---|---|---|
| `openai:<모델>` | `sttEngine: 'whisper'` (3초 청크, `/v1/audio/transcriptions`) | `gpt-4o-mini-transcribe`, `gpt-4o-transcribe`, `whisper-1` |
| `openai:<모델>:full` | — | 파일 통째로 전송. 청크로 자를 때 손해 보는 정도를 보는 기준선 |
| `realtime:<모델>` | `sttEngine: 'realtime'` (전사 세션, turn_detection 미지정) | 익스텐션은 WebRTC, 여기서는 같은 세션을 WebSocket으로 연결 |
| `local:<모델>` / `local:<모델>:full` | — (Lite Helper 후보) | faster-whisper. `tiny`, `base`, `small`, `medium`, `large-v3`, `large-v3-turbo` 또는 로컬 모델 경로 |

Web Speech API는 브라우저 안에서만 돌아가므로 이 도구로는 측정할 수 없습니다.

## 설치

Python 3.10 이상이 필요합니다.

```bash
cd tools/stt-benchmark
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[local,dev]"
```

macOS/Linux에서는 `.venv/bin/python`을 씁니다. 로컬 엔진이 필요 없으면 `.[dev]`만 설치해도 됩니다.

OpenAI 엔진을 쓰려면 이 폴더에 `.env`를 만듭니다(커밋되지 않음).

```text
OPENAI_API_KEY=sk-...
```

## 데이터셋 준비

`datasets/` 아래 **첫 번째 폴더 이름이 언어**입니다. 그 아래는 자유롭게 나눠도 됩니다.

```text
datasets/
├── ja/
│   ├── vtuber-a/
│   │   ├── clip01.m4a
│   │   └── clip01.srt      ← 정답 (타임코드 있으면 지연 계산에도 사용)
│   └── clip02.wav
│       clip02.txt          ← 정답 (텍스트만)
├── ko/
└── en/
```

- 오디오: `wav`, `mp3`, `m4a`, `aac`, `flac`, `ogg`, `opus`, `webm`, `mp4`, `mkv`
- 정답: 같은 이름의 `.txt` → `.srt` → `.vtt` 순으로 찾습니다.
- 언어 폴더 이름은 익스텐션 설정값을 그대로 씁니다(`ko`, `ja`, `en`, `zh-CN` …).
- `.srt`/`.vtt` 정답의 타임코드는 **클립 시작이 0초**여야 합니다. 긴 영상에서 잘라낸 클립이면 자막도 같이 잘라 시간을 맞춰야 합니다.
- 타임코드가 없으면 음량으로 첫 발화 시작/마지막 발화 끝을 추정합니다. 배경음(BGM)이 큰 클립은 이 추정이 부정확하므로 `.srt`/`.vtt` 정답을 권장합니다.
- 클립 길이는 10초~3분 정도를 권장합니다. `:full` 모드는 업로드 한도(25MB, 16kHz wav 기준 약 13분)를 넘으면 실패합니다.
- 데이터셋과 결과는 저작권 있는 음성이 들어갈 수 있어서 git에 올라가지 않습니다.

## 실행

```bash
.venv/Scripts/python -m stt_bench run \
  -e openai:gpt-4o-mini-transcribe \
  -e openai:gpt-4o-transcribe \
  -e realtime:gpt-realtime-whisper \
  -e local:small
```

자주 쓰는 옵션:

| 옵션 | 설명 |
|---|---|
| `--lang ja` | 특정 언어 폴더만 (여러 번 지정 가능) |
| `--limit 5` | 앞에서부터 5개 클립만 (비용 확인용) |
| `--chunk-sec 3` | 청크 길이. 익스텐션 기본값은 3초 |
| `--auto-lang` | 언어 힌트 없이 실행 (익스텐션 `sourceLang: auto`) |
| `--device cuda` / `--compute-type float16` | 로컬 엔진 장치/정밀도 (기본 `auto`) |
| `--dataset`, `--out` | 데이터셋/결과 폴더 위치 |

`local` 엔진은 첫 실행 때 Hugging Face에서 모델을 내려받습니다(tiny 약 75MB, small 약 480MB, large-v3 약 3GB).
`--device auto`(기본)는 NVIDIA GPU가 보이면 cuda를 쓰고, CUDA 12용 cuBLAS/cuDNN 9 DLL이 없어
`cublas64_12.dll is not found` 오류가 나면 CPU로 다시 시도합니다. `--device cuda`를 직접 지정하면 다시 시도하지 않고 실패합니다.

`realtime` 엔진은 오디오를 실제 재생 속도로 보내므로 **클립 길이만큼 시간이 걸립니다**.
OpenAI 엔진은 클립 길이만큼 비용이 나가니 `--limit`으로 먼저 확인하세요.

결과는 `results/<실행 시각>/`에 저장됩니다.

- `report.md`: 요약 표, 클립별 표, 정답/결과 텍스트 비교
- `results.jsonl`: 클립×엔진 한 줄씩 원본 데이터 (청크별 텍스트, 이벤트 수 등)
- `summary.json`: 요약 표 데이터

중간에 `Ctrl+C`로 멈춰도 그때까지의 결과로 리포트를 만듭니다. 리포트만 다시 만들려면:

```bash
.venv/Scripts/python -m stt_bench report results/20261105-153000
```

## 지표

| 지표 | 의미 |
|---|---|
| CER | 문장부호·공백·대소문자·전각/반각을 정규화한 뒤 글자 단위 오류율. 클립을 합쳐서 계산 |
| S / D / I | 대치 / 삭제(놓친 글자) / 삽입(없는 말을 만든 글자). 삽입이 높으면 무음 구간 환각을 의심 |
| WER | 띄어쓰기 언어(en/es/fr/de/ru)만 계산 |
| 첫 텍스트 | 첫 발화 시작 → 첫 텍스트 도착 |
| 마지막 발화→텍스트 | 마지막 발화 끝 → 그 말이 텍스트로 도착. 클립당 1개 값 |
| 구간 끝→확정 | 청크 엔진: 청크 녹음 끝 → 결과(큐 대기 포함). Realtime VAD 모델: 발화 턴 끝 → `completed` |
| RTF | 처리 시간 / 오디오 길이. 청크 엔진은 1 미만이어야 큐가 밀리지 않음 |

지연 계산 방식:

- **청크 엔진**: 요청은 클립마다 순서대로 보내고 걸린 시간만 잽니다. 그 값을 가지고 "녹음은 계속되고 처리는 직렬 큐"인 익스텐션 동작(`offscreen.js`의 `processingQueue`)을 시뮬레이션해 지연을 계산합니다.
- **Realtime 엔진**: 100ms 프레임을 실제 시간에 맞춰 보내고, 이벤트가 도착한 시각을 그대로 잽니다. 세션 연결 시간은 빼고 `extra.connect_ms`에 따로 기록합니다.
- `gpt-realtime-whisper`처럼 VAD를 지원하지 않는 모델은 `completed` 없이 delta만 옵니다. 익스텐션은 이 경우 침묵 감지 시간(기본 1.5초)이 지나야 확정 표시하므로, 체감 확정 지연은 "마지막 발화→텍스트 + 침묵 감지 시간"입니다.

## 한계

- 한자/가나 표기 차이(今日 ↔ きょう), 숫자 표기 차이(3 ↔ 三 ↔ 세)는 오류로 셉니다. 정답 자막의 표기 습관에 따라 CER이 달라질 수 있습니다.
- 청크 엔진은 익스텐션과 달리 webm/opus가 아니라 16kHz wav로 보냅니다. 인식 결과에 미치는 영향은 작지만 완전히 같지는 않습니다.
- 지연은 이 PC의 네트워크 상태에 따라 달라집니다. 엔진끼리 비교할 때는 같은 실행 안에서 비교하세요.
- Whisper 계열은 무음/잡음 구간에서 환각이 생기면 temperature fallback(샘플링)이 끼어들어, 같은 입력도 실행마다 결과가 조금 달라집니다. 클립 1~2개로 결론 내지 말고 언어당 10개 이상을 권장합니다.

## 테스트

```bash
.venv/Scripts/python -m pytest
```

OpenAI 요청 형식과 Realtime 이벤트 처리는 mock 서버로 확인하므로 API 키 없이 돌아갑니다.
