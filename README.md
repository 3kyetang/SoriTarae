# SoriTarae (소리타래)

> 목소리로 남긴 하루를 AI가 일기로 엮고, 나중에는 내 기록에 근거해 질문에 답하는 개인 일기 웹 서비스입니다.

## 1. 프로젝트 소개

### 문제

하루를 기록하고 싶어도 긴 글을 직접 쓰는 일은 부담스럽습니다. 기존 메모나 녹음 앱은 기록을 남기는 데에는 유용하지만, 말로 남긴 내용을 읽기 좋은 일기로 정리하거나 과거 기록에서 필요한 내용을 찾아 답해 주지는 못합니다.

SoriTarae는 사용자가 편하게 말한 내용을 자연스러운 한국어 일기로 정리하고, 로그인 사용자가 축적한 일기를 안전하게 보관한 뒤 자신의 기록에 대해 질문할 수 있도록 만들었습니다.

### 대상 사용자

- 글쓰기보다 말하기가 편한 사용자
- 짧은 시간에 하루를 기록하고 싶은 사용자
- 여러 일기에서 과거 경험이나 최근 일을 다시 찾고 싶은 사용자
- 계정별로 분리된 개인 기록 공간이 필요한 사용자

### 주요 기술

- **Frontend / Backend:** Next.js 16, React 19, TypeScript
- **일기 생성·답변:** Gemini API (`gemini-3.6-flash`)
- **인증·데이터베이스:** Supabase Auth, PostgreSQL, Row Level Security
- **임베딩:** `jhgan/ko-sroberta-multitask` (768차원)
- **검색:** pgvector 의미 검색 + 최근 기록 검색을 결합한 하이브리드 RAG
- **배포:** Vercel(Next.js), Google Cloud Run(임베딩 서비스)

## 2. 핵심 사용자 흐름과 AI 기능

### 일기 작성

1. 브라우저에서 직접 녹음하거나 오디오 파일을 업로드합니다.
2. `기본형` 또는 `핵심 요약` 스타일을 선택합니다.
3. Gemini가 음성을 이해해 제목·본문·기분·키워드가 포함된 한국어 일기를 생성합니다.
4. 사용자는 결과를 수정하고 저장하거나 TXT 파일로 내보낼 수 있습니다.
5. 음성을 사용하지 않을 때에는 `직접 작성`으로 AI 호출 없이 일기를 작성할 수 있습니다.

비로그인 사용자도 녹음과 AI 일기 생성을 사용할 수 있으며, 완성된 일기는 현재 브라우저의 `localStorage`에 저장됩니다. 로그인 사용자의 일기는 Supabase에 저장되고 어느 기기에서든 자신의 계정으로 조회·수정·삭제할 수 있습니다. 기존 로컬 일기는 사용자가 직접 선택해 클라우드로 이전할 수 있습니다.

### 내 일기에 질문하기

1. 로그인 사용자가 자신의 일기에 관한 질문을 입력합니다.
2. 질문과 일기 내용을 한국어 임베딩으로 변환합니다.
3. pgvector 의미 검색으로 관련 일기를 찾습니다.
4. `최근`, `요즘`, `마지막 기록` 같은 시간 의도가 있으면 최신 일기도 함께 조회합니다.
5. 중복 결과를 제거한 뒤 Gemini가 검색된 일기만 근거로 답변합니다.
6. 답변과 함께 참고한 일기의 제목·날짜·검색 방식을 표시합니다.

관련 기록을 찾지 못하면 Gemini를 호출하지 않고 자료가 없다고 안내합니다. Supabase RLS와 서버 측 사용자 검증을 함께 적용해 다른 사용자의 일기가 검색 결과에 포함되지 않도록 구성했습니다.

## 3. 사용 데이터·문서와 출처

### 사용 데이터

**별도의 학습 데이터셋이나 외부 수집 데이터는 사용하지 않았습니다.** 웹 크롤링, 공개 일기 데이터, 제3자 개인정보도 사용하지 않았습니다.

서비스 실행 중 처리되는 데이터는 사용자가 직접 입력한 다음 항목뿐입니다.

- 녹음 또는 업로드한 음성
- 직접 작성하거나 AI가 생성한 일기
- 사용자가 자신의 일기에 대해 입력한 질문

음성은 일기 생성 요청을 처리하기 위해 Gemini API로 전송되지만 SoriTarae의 일기 데이터베이스에는 원본 음성을 저장하지 않습니다. 로그인 일기는 Supabase에, 비로그인 일기는 해당 브라우저에 저장됩니다.

### 기획·설계 자료

- 사용자가 작성한 서비스 화면 요구사항 문서
- Google Gemini를 이용한 초기 아이디어 정리
- Google Stitch로 제작한 초기 UI 프로토타입
- 개발 과정에서 작성한 Supabase·RLS·RAG 구현 계획과 마이그레이션 SQL

위 자료는 프로젝트 내부 기획 및 구현을 위해 직접 작성한 자료이며 외부 데이터 출처가 아닙니다.

## 4. 실행·배포 방법

### 준비 사항

- Node.js 22.13 이상
- Python 가상환경과 Python 3.11 이상
- Gemini API 키
- Supabase 프로젝트 URL과 Publishable Key
- 임베딩 서비스용 32자 이상의 임의 토큰

### 4.1 Supabase 설정

Supabase SQL Editor에서 다음 파일을 이름 순서대로 실행합니다.

```text
supabase/migrations/20260728000000_create_diaries.sql
supabase/migrations/20260728010000_add_manual_diary_style.sql
supabase/migrations/20260729000000_create_diary_embeddings.sql
```

마이그레이션에는 `diaries`, `diary_embeddings`, pgvector 검색 함수와 사용자별 SELECT·INSERT·UPDATE·DELETE RLS 정책이 포함되어 있습니다.

Supabase Authentication의 Site URL과 Redirect URL에는 로컬 주소와 운영 주소를 등록합니다.

```text
http://localhost:3000/**
https://soritarae.vercel.app/**
```

### 4.2 환경변수

저장소 루트에서 `.env.example`을 `.env.local`로 복사하고 실제 값을 입력합니다.

```dotenv
# 서버 전용: NEXT_PUBLIC_ 접두사를 붙이지 않습니다.
GEMINI_API_KEY=your_gemini_api_key

# 브라우저에 공개 가능한 Supabase 프로젝트 식별자입니다. 실제 데이터는 RLS로 보호합니다.
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key

# Next.js 서버와 임베딩 서비스 사이에서만 사용합니다.
EMBEDDING_SERVICE_URL=http://127.0.0.1:8001
EMBEDDING_SERVICE_TOKEN=replace_with_at_least_32_random_characters
```

`.env.local`은 Git에 커밋하지 않습니다. `GEMINI_API_KEY`와 `EMBEDDING_SERVICE_TOKEN`에는 절대로 `NEXT_PUBLIC_` 접두사를 붙이지 마세요.

### 4.3 임베딩 서비스 실행

Windows에서는 PyTorch의 긴 파일 경로 문제를 피하기 위해 짧은 위치에 가상환경을 만드는 것을 권장합니다.

```powershell
py -3.11 -m venv C:\soritarae-venv
Set-Location embedding-service
& "C:\soritarae-venv\Scripts\python.exe" -m pip install -r requirements.txt
& "C:\soritarae-venv\Scripts\python.exe" verify_model.py
& "C:\soritarae-venv\Scripts\python.exe" -m uvicorn app:app --host 127.0.0.1 --port 8001
```

최초 실행 시 Hugging Face에서 `jhgan/ko-sroberta-multitask` 모델을 내려받으므로 시간이 걸릴 수 있습니다. 검증 결과에 `dimensions=768`, `normalized=True`가 표시되어야 합니다.

### 4.4 Next.js 실행

새 터미널에서 다음 명령을 실행합니다.

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. Windows PowerShell 실행 정책으로 `npm`이 차단되면 `npm.cmd`를 사용합니다.

```powershell
npm.cmd install
npm.cmd run dev
```

운영 빌드는 다음과 같이 확인합니다.

```bash
npm run lint
npm test
```

### 4.5 운영 배포

#### Google Cloud Run — 임베딩 서비스

`embedding-service/Dockerfile`로 컨테이너를 배포합니다. 권장 설정은 서울 리전, CPU 1, 메모리 2 GiB, 동시 요청 1, 최소 인스턴스 0, 최대 인스턴스 1, 요청 제한 시간 300초입니다.

`EMBEDDING_SERVICE_TOKEN`은 Google Secret Manager에 저장하고 Cloud Run 컨테이너에 같은 이름의 환경변수로 연결합니다. 서비스 URL은 외부 요청을 받을 수 있어야 하지만 `/health`와 `/embed`는 Bearer 토큰 없이는 접근할 수 없습니다.

#### Vercel — Next.js 앱

1. GitHub의 `3kyetang/voicelog` 저장소를 Vercel 프로젝트로 연결합니다.
2. Framework Preset은 `Next.js`, Root Directory는 저장소 루트로 설정합니다.
3. 다음 환경변수를 Production에 등록합니다.

```text
GEMINI_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
EMBEDDING_SERVICE_URL=https://your-cloud-run-service-url
EMBEDDING_SERVICE_TOKEN
```

4. 환경변수를 추가하거나 변경한 뒤 Production을 다시 배포합니다.

## 5. 테스트·검증·수정 결과

### 자동 검증

```bash
npm run lint
npm test
```

`npm test`는 Next.js 운영 빌드와 Node 기반 소스·보안 회귀 테스트를 함께 실행합니다. 현재 테스트는 다음 항목을 포함합니다.

최종 검증 결과는 **48개 테스트 전체 통과(48/48)**이며, Next.js 운영 빌드와 TypeScript 검사도 통과했습니다.

- Gemini 키와 임베딩 토큰의 서버 전용 사용
- 이메일 회원가입·로그인·로그아웃·비밀번호 재설정 흐름
- 로그인/비로그인 저장소 분리와 로컬 일기 클라우드 이전
- 사용자별 CRUD 및 RLS 소유권 검사
- 768차원 임베딩 생성과 인증된 임베딩 API
- RAG 입력 검증, 자료 없음 처리, 출처 반환
- 의미 검색과 최근 기록을 결합한 하이브리드 검색
- Vercel 요청 크기·실행 시간과 Cloud Run 배포 설정

### 주요 수정 결과

| 발견한 문제 | 수정 내용 | 결과 |
| --- | --- | --- |
| `extensions.vector <=> extensions.vector` 연산자 오류 | pgvector 스키마와 함수의 검색 경로·타입을 명시 | 768차원 유사도 검색 정상화 |
| “최근에 한 일이 뭐야?”가 의미 검색에서 누락 | 시간 의도 감지 시 최근 일기 3개를 의미 검색 결과와 병합 | 단어가 겹치지 않아도 최신 기록에 근거해 답변 |
| 저장 완료 팝업이 늦고 저장 중 표시가 먼저 사라짐 | 저장 요청 전체 구간에서 상태를 유지하도록 조정 | 완료 시점과 UI 안내 일치 |
| 이메일 보안 스캐너가 복구 링크를 먼저 소비 | 기본 복구 흐름과 브라우저 독립 일회용 세션을 보완 | 실제 사용자가 새 비밀번호 설정 가능 |
| 다른 브라우저에서 비밀번호 복구 실패 | 복구 토큰 처리와 세션 전달 방식을 수정 | 요청 브라우저와 다른 브라우저에서도 최초 1회 사용 가능 |

최종 수동 점검에서는 회원가입, 로그인, 음성 일기 생성, 저장·수정·삭제, 내 일기 질문, 출처 확인, 비밀번호 재설정과 운영 배포를 확인했습니다.

## 6. 현재 한계와 보류 항목

- 업로드 가능한 오디오 파일은 최대 4MB입니다.
- 브라우저가 백그라운드로 전환되거나 운영체제가 마이크 사용을 중단하면 녹음이 종료될 수 있습니다.
- 비로그인 기록은 브라우저별 `localStorage`에 저장되므로 다른 기기·브라우저와 자동 동기화되지 않습니다.
- 비로그인 상태에서도 AI 일기 생성이 가능하므로 공개 운영 시 사용량 제한·봇 방지·비용 제어가 추가로 필요합니다.
- Cloud Run 최소 인스턴스가 0이면 첫 임베딩 요청에서 콜드 스타트가 발생할 수 있습니다.
- RAG 답변은 사용자가 저장한 일기만 근거로 하며, 기록되지 않은 사실에는 답할 수 없습니다.
- 실시간 STT, 자동 감정 분석 고도화, 사진·위치 첨부, 로컬 기록 자동 이전은 현재 보류했습니다.
- `직접 작성`은 사용자의 원문을 그대로 저장하며 Gemini가 별도로 수정하거나 요약하지 않습니다.
- 비밀번호 재설정 이메일 링크는 보안을 위해 한 번만 사용할 수 있습니다.

## 7. 결과물 링크

- **운영 서비스:** [https://soritarae.vercel.app](https://soritarae.vercel.app)
- **GitHub 저장소:** [https://github.com/3kyetang/voicelog](https://github.com/3kyetang/voicelog)

---

SoriTarae는 “목소리가 실타래처럼 엮여 나만의 일기가 된다”는 의미를 담고 있습니다.
