# VoiceLog

목소리로 하루를 기록하고 Gemini AI가 자연스러운 한국어 일기로 정리해 주는 반응형 웹 앱입니다.

## 주요 기능

- 브라우저 마이크 녹음 및 실시간 파형·녹음 시간 표시
- 긴 침묵에도 자동 종료되지 않는 녹음 흐름
- WAV, MP3, M4A, AAC, OGG, FLAC, AIFF 파일 업로드
- 기본형과 핵심 요약의 두 가지 일기 스타일
- Gemini 오디오 이해를 이용한 음성 해석과 일기 생성
- 생성 결과 편집, 되돌리기·다시 실행, 재생성, 복사, 텍스트 다운로드
- 브라우저 로컬 저장소 기반 기록 보관
- 음성 품질이 좋지 않을 때 직접 작성으로 전환
- 모바일 하단 내비게이션과 데스크톱 레이아웃

## 준비 사항

- Node.js 22.13 이상
- Gemini API 키

## 로컬 실행

```bash
npm install
```

`.env.example`을 `.env.local`로 복사하고 API 키를 입력합니다.

```dotenv
GEMINI_API_KEY=your_gemini_api_key
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
- 완성한 일기는 현재 브라우저의 `localStorage`에만 저장됩니다.
- 음성 원본은 VoiceLog의 로컬 기록에 저장하지 않습니다.

## 지원 범위

- 업로드 파일은 최대 14MB입니다.
- 모바일 운영체제나 브라우저가 백그라운드에 들어가면 녹음이 중단될 수 있습니다.
- 마이크 권한을 사용할 수 없는 환경에서는 파일 업로드 또는 직접 작성 기능을 이용할 수 있습니다.

## API

- `POST /api/generate`: 오디오 또는 직접 입력한 텍스트로 일기를 생성합니다.
- `GET /api/status`: Gemini 연결 설정 여부와 사용 모델을 확인합니다.

현재 생성 모델은 `gemini-3.6-flash`입니다.

## Cloudflare Workers 배포

이 저장소에는 Cloudflare Workers용 `wrangler.jsonc`가 포함되어 있습니다.

1. Cloudflare에 로그인합니다.
2. 최초 배포를 실행합니다.

```bash
npm run deploy
```

3. 배포된 Worker에 Gemini API 키를 암호화된 Secret으로 등록합니다.

```bash
npx wrangler secret put GEMINI_API_KEY
```

입력한 값은 소스 코드나 GitHub 저장소에 포함되지 않으며 Cloudflare에서도 숨겨집니다. 이후 코드를 변경하면 `npm run deploy`로 다시 배포할 수 있습니다.

GitHub 자동 배포를 사용하려면 Cloudflare Workers & Pages에서 이 비공개 저장소를 연결하고, 빌드 명령을 `npm run build`, 배포 명령을 `npx wrangler deploy`로 지정합니다. 서비스 접근을 제한하려면 배포 후 Cloudflare Access에서 허용할 이메일 주소만 등록하세요.
