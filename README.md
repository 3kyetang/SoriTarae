# SoriTarae

목소리로 하루를 기록하고 Gemini AI가 자연스러운 한국어 일기로 정리해 주는 반응형 웹 앱입니다.

## 주요 기능

- 브라우저 마이크 녹음 및 실시간 파형·녹음 시간 표시
- 긴 침묵에도 자동 종료되지 않는 녹음 흐름
- WAV, MP3, M4A, AAC, OGG, FLAC, AIFF 파일 업로드
- 기본형과 핵심 요약의 두 가지 일기 스타일
- Gemini 오디오 이해를 이용한 음성 해석과 일기 생성
- 생성 결과 편집, 되돌리기·다시 실행, 재생성, 복사, 텍스트 다운로드
- 로그인 사용자의 Supabase 클라우드 기록 보관 및 사용자별 조회·수정·삭제
- 비로그인 사용자의 브라우저 로컬 저장소 기반 기록 보관
- 로그인 후 사용자가 직접 실행하는 로컬 기록의 안전한 클라우드 이전
- 음성 품질이 좋지 않을 때 AI를 거치지 않는 `직접 작성` 기록으로 전환
- 모바일 하단 내비게이션과 데스크톱 레이아웃

## 준비 사항

- Node.js 22.13 이상
- Gemini API 키
- Supabase 프로젝트 URL과 Publishable Key

## 로컬 실행

```bash
npm install
```

`.env.example`을 `.env.local`로 복사하고 API 키를 입력합니다.

```dotenv
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

개발 서버를 시작합니다.

```bash
npm run dev
```

운영 빌드를 확인하려면 다음 명령을 사용합니다.

```bash
npm run build
npm run start
```

Windows PowerShell의 실행 정책 때문에 `npm`이 차단되면 `npm.cmd`를 사용하세요.

```powershell
npm.cmd install
npm.cmd run dev
```

## 환경변수와 개인정보

- `GEMINI_API_KEY`는 서버에서만 읽으며 브라우저 번들에 포함되지 않습니다.
- AI 생성 요청을 보낼 때만 선택한 음성 파일이 Gemini API로 전송됩니다.
- API 요청은 저장 비활성화 옵션을 사용합니다.
- 로그인 사용자의 완성된 일기는 RLS가 적용된 Supabase `diaries` 테이블에 저장됩니다.
- 비로그인 사용자의 완성된 일기와 편집 중인 초안은 현재 브라우저의 `localStorage`에 저장됩니다.
- 로그인한 사용자끼리도 자신의 일기만 조회·수정·삭제할 수 있습니다.
- 로컬 일기는 사용자가 `클라우드로 가져오기`를 선택하고 이전 결과가 확인된 뒤에만 로컬 저장소에서 정리됩니다.
- 음성 원본은 SoriTarae의 로컬 기록에 저장하지 않습니다.

## 지원 범위

- Vercel Functions 요청 제한을 고려해 업로드 파일은 최대 4MB입니다.
- 모바일 운영체제나 브라우저가 백그라운드에 들어가면 녹음이 중단될 수 있습니다.
- 마이크 권한을 사용할 수 없는 환경에서는 파일 업로드 또는 직접 작성 기능을 이용할 수 있습니다.

## API

- `POST /api/generate`: 오디오 또는 직접 입력한 텍스트로 일기를 생성합니다.
- `GET /api/status`: Gemini 연결 설정 여부와 사용 모델을 확인합니다.

현재 생성 모델은 `gemini-3.6-flash`입니다.

## Vercel 배포

1. Vercel에서 GitHub의 비공개 `3kyetang/voicelog` 저장소를 가져옵니다.
2. Framework Preset은 `Next.js`, Root Directory는 저장소 루트로 둡니다.
3. Environment Variables에 `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 추가합니다.
4. Deploy를 실행합니다.

`GEMINI_API_KEY`는 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 키는 서버 함수에서만 읽으며 GitHub 저장소와 브라우저 번들에 포함되지 않습니다. 환경변수를 추가하거나 변경한 뒤에는 새로 배포해야 적용됩니다.
