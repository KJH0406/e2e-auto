# E2E 테스트 전략

Claude Code 토큰 소비 최소화를 목표로 하는 E2E 테스트 실행 전략입니다.

---

## 원칙

- 실패 재시도는 최대 1회로 제한한다
- 요소를 찾지 못하면 즉시 중단하고 부분 코드를 제공한다
- Screenshot은 사용하지 않는다
- 브라우저 열기 전 `auth.json` 존재 여부를 먼저 확인한다

---

## 도구 사용 원칙

**Bash는 playwright-cli 명령 전용이다.** 파일 작업은 반드시 전용 도구를 사용한다.

| 작업      | 사용 도구 | 금지          |
| --------- | --------- | ------------- |
| 파일 읽기 | Read      | Bash(cat)     |
| 파일 목록 | Glob      | Bash(ls)      |
| 내용 검색 | Grep      | Bash(grep)    |
| 파일 쓰기 | Write     | Bash(echo >)  |
| 파일 수정 | Edit      | Bash(sed/awk) |

전용 도구는 권한 확인 없이 자동 실행된다. Bash는 `npx playwright-cli*` 패턴만 허용되어 있으므로 그 외 Bash 사용은 차단된다.

**스냅샷 파일 검색 방법 (Bash 파이프라인 금지):**

```
1. Glob(".playwright-cli/*.yml") → 수정 시간 순 정렬, 마지막 항목이 최신 파일
2. Grep(pattern, path=<최신 파일>, output_mode="content", -A=3)
```

---

## 스냅샷 동작 원리

모든 playwright-cli 명령은 실행 후 자동으로 스냅샷 **파일**을 생성한다.
단, 파일 경로만 출력될 뿐 **내용은 컨텍스트에 자동 로드되지 않는다**.

```
### Snapshot
- [Snapshot](.playwright-cli/page-2026-03-02T05-42-38-690Z.yml)  ← 경로만 출력됨
```

내용을 보려면 파일을 직접 읽어야 하며, 이때 토큰이 소비된다.

**토큰 비용 구조:**

| 동작                                | 토큰 비용                     |
| ----------------------------------- | ----------------------------- |
| 명령어 실행 (click, fill 등)        | 낮음 — 파일 경로만 출력       |
| 스냅샷 파일 전체 Read               | 높음 — 수백 줄 YAML 로드      |
| 스냅샷 파일 grep / offset 부분 읽기 | 낮음 — 필요한 부분만 로드     |
| goto 직후 명시적 `snapshot`         | 허용 — SPA 렌더링 완료 보장   |
| 그 외 명시적 `snapshot`             | 낭비 — 자동 생성 파일로 충분  |
| 확인 목적의 grep (다음 ref 불필요)  | 낭비 — 결과 검증 목적 외 금지 |

---

## grep 실행 판단 트리

**핵심 원칙: 다음 액션에 새로운 ref가 필요할 때만 grep을 실행한다.**

```
다음 액션에 새로운 ref가 필요한가?
  YES → grep 실행 (키워드 1~2개, 타겟 최소화)
  NO  → 즉시 다음 명령 실행
```

**액션 유형별 grep 필요 여부:**

| 액션 유형                   | grep 필요 | 이유                      |
| --------------------------- | --------- | ------------------------- |
| goto / 링크 클릭 (URL 변경) | ✅ 필수   | 새 페이지 구조 파악       |
| modal / dialog 열기         | ✅ 필수   | 내부 모든 ref 한번에 확보 |
| dropdown / combobox 열기    | ✅ 필수   | 동적 생성 옵션 ref 확보   |
| submit / 최종 액션          | ✅ 필수   | 결과 및 토스트 검증       |
| fill / check / press        | ❌ 불필요 | 입력 결과는 deterministic |
| option 선택 (ref 이미 확보) | ❌ 불필요 | 이미 ref 확보 완료        |
| 이전 액션의 완료 확인       | ❌ 불필요 | 확인용 grep은 낭비        |

**Grep 패턴 원칙:**

```
# 좋은 예: 다음 액션에 필요한 요소만 타겟 (키워드 1~2개)
Glob(".playwright-cli/*.yml") → 최신 파일 경로 확인
Grep("listbox|option", path=<최신 파일>, output_mode="content", -A=3)
Grep("dialog|heading.*새로운", path=<최신 파일>, output_mode="content", -A=2)

# 좋은 예: 전후 맥락이 필요하면 -C로 한 번에
Grep("생성되었습니다", path=<최신 파일>, output_mode="content", -C=3)

# 나쁜 예: 키워드 과다 → 출력 수십 줄
Grep("dialog|modal|input|이름|마감|담당|상태|프로젝트|생성", ...)

# 나쁜 예: 전체 파일 읽기
Read(".playwright-cli/page-xxx.yml")
```

---

## 스냅샷 파일 읽기 규칙

스냅샷 파일은 항상 **필요한 부분만** 읽는다.

```
# 좋은 예: Grep으로 필요한 부분만 추출
Glob(".playwright-cli/*.yml") → 최신 파일 경로 확인
Grep("listbox", path=<최신 파일>, output_mode="content", -A=3)
Grep("생성되었습니다", path=<최신 파일>, output_mode="content", -C=3)

# 좋은 예: offset으로 특정 구간만 읽기
Read(".playwright-cli/page-xxx.yml", offset=200, limit=50)

# 나쁜 예: 전체 파일 읽기
Read(".playwright-cli/page-xxx.yml")
```

**명시적 `snapshot` 명령 실행 기준:**

- **goto 직후 — 항상 1회 실행** (SPA는 JS 렌더링 완료 전에 자동 스냅샷이 생성될 수 있다)
- 요소 탐색 실패 후 재시도 — 최대 1회

그 외 모든 경우는 명령 실행 후 자동 생성된 최신 파일을 grep으로 읽는다.

---

## Glob 사용 규칙

| 상황                    | 처리 방법                                       |
| ----------------------- | ----------------------------------------------- |
| 파일 경로가 명시된 경우 | Glob 없이 바로 Read / Write                     |
| 설정 파악 필요          | `playwright.config.ts` 1개 Read로 충분          |
| 중복 테스트 확인        | `Glob tests/*.spec.ts` (목록만, 내용 읽지 않음) |
| 기존 패턴 참조 필요     | 관련 파일 1개만 Read                            |

```bash
# 절대 금지
Glob **/*.ts         # node_modules 포함 수백 개 반환

# 허용
Glob tests/*.spec.ts
Glob *.config.ts
```

---

## 실행 흐름

### 1단계: 시나리오 확인

사용자가 테스트 시나리오를 제공하지 않으면 먼저 요청한다.

시나리오에는 다음이 포함되어야 한다:

- 테스트 대상 URL
- 순서대로 나열된 실행 단계
- 각 단계에서 기대하는 결과

### 2단계: 브라우저 열기 및 인증

브라우저를 열기 전에 `auth.json`이 존재하는지 먼저 확인한다.

**auth.json이 있는 경우 — state-load 방식:**

```bash
npx playwright-cli open
npx playwright-cli state-load auth.json
npx playwright-cli goto <URL>
```

**auth.json이 없는 경우 — cookie-set 방식:**

```bash
npx playwright-cli open
npx playwright-cli cookie-set "<name>" "<value>" --domain=<domain> --httpOnly --secure
npx playwright-cli goto <URL>
```

- `state-load`는 브라우저가 열린 후에만 실행 가능하다
- `open` 시 URL을 함께 전달하지 않는다 — 인증 전이므로 리다이렉트될 수 있다

### 3단계: 초기 페이지 상태 확인

goto 후 SPA 렌더링 완료를 보장하기 위해 **항상** 명시적 snapshot을 1회 실행한다.

```bash
npx playwright-cli goto <URL>
npx playwright-cli snapshot
```

```
Glob(".playwright-cli/*.yml") → 최신 파일 경로 확인
Grep("<진입점 요소 키워드>", path=<최신 파일>, output_mode="content", -A=3)
```

- goto 자동 스냅샷은 JS 렌더링 전일 수 있으므로 신뢰하지 않는다
- 명시적 snapshot 후에도 콘텐츠가 비어있으면 → 요소 탐색 실패 처리로 이동

### 4단계: 시나리오 순서대로 실행

**grep 실행 판단 트리**를 기준으로 필요한 경우에만 스냅샷을 읽는다.

```bash
# modal / dialog 열기 → Grep 필수 (내부 모든 ref 한번에 확보)
npx playwright-cli click <ref>
```

```
Glob(".playwright-cli/*.yml") → 최신 파일
Grep("dialog|textbox|button.*생성", path=<최신 파일>, output_mode="content", -A=2)
```

```bash
# fill → Grep 없음
npx playwright-cli fill <ref> "<value>"

# combobox 열기 → Grep 필수 (옵션 ref 확보)
npx playwright-cli click <combobox-ref>
```

```
Grep("listbox|option", path=<최신 파일>, output_mode="content", -A=2)
```

```bash
# option 선택 → Grep 없음 (ref 이미 확보)
npx playwright-cli click <option-ref>

# submit → Grep 필수 (결과 검증)
npx playwright-cli click <submit-ref>
```

```
Glob(".playwright-cli/*.yml") → 최신 파일
Grep("<기대 메시지>", path=<최신 파일>, output_mode="content", -C=3)
```

**배치 플래닝 원칙:**

modal/dialog가 열린 직후 grep으로 내부 **모든 ref를 한번에 확보**한다.
확보된 ref는 이후 해당 페이지에서 재사용하며, 중간 확인용 grep을 실행하지 않는다.

### 5단계: 요소 탐색 실패 처리

```
요소 탐색 실패
→ 명시적 snapshot 1회 후 재시도
→ 요소 발견 시 계속 진행
→ 그래도 실패 시 즉시 중단
  → 현재까지 완성된 코드 제공
  → 실패한 단계와 이유 안내
  → 이후 단계는 요소 확인 필요 명시
```

---

## playwright-cli 명령어 참조

```bash
# 브라우저
npx playwright-cli open
npx playwright-cli close
npx playwright-cli list          # 현재 열린 세션 확인

# 네비게이션
npx playwright-cli goto <URL>
npx playwright-cli go-back
npx playwright-cli reload

# 요소 상호작용
npx playwright-cli click <ref>
npx playwright-cli fill <ref> "<value>"
npx playwright-cli select <ref> "<value>"
npx playwright-cli check <ref>
npx playwright-cli press <key>          # Enter, Escape, ArrowDown 등

# 인증 / 스토리지
npx playwright-cli state-load auth.json
npx playwright-cli cookie-set "<name>" "<value>" --domain=<domain> --httpOnly --secure

# 상태 확인
npx playwright-cli snapshot             # goto 직후 항상 / 요소 탐색 실패 시 최대 1회
```

---

## 금지 사항

- `screenshot` 명령 사용 금지 — 이미지 처리 비용이 높다
- goto 이외 상황에서 별도 `snapshot` 명령 실행 금지 — 자동 생성 파일을 Grep으로 충분하다
- 스냅샷 파일 전체 Read 금지 — Grep 또는 offset으로 필요한 부분만 읽는다
- `state-load`를 브라우저 open 전에 실행 금지
- 브라우저 열기 전 auth.json 확인 생략 금지 — 인증 실패 세션 낭비를 방지한다
- `Glob **/*.ts` 사용 금지 — node_modules 포함 수백 개 반환으로 컨텍스트를 낭비한다
- 파일 경로가 명시된 경우 Glob 사용 금지 — 바로 Read / Write한다
- 확인 목적의 Grep 사용 금지 — 다음 ref 확보 또는 결과 검증 목적 외 Grep은 낭비다
- 동일 정보를 두 번 Grep 금지 — `-C` 옵션으로 전후 맥락을 한 번에 읽는다
- **파일 작업에 Bash 사용 금지** — cat/ls/grep 대신 Read/Glob/Grep 전용 도구를 사용한다
- **playwright-cli 외 Bash 사용 금지** — settings.json에서 차단되며, 권한 확인 프롬프트가 발생한다

---

## 실패 시 결과물 형식

```
## 완료된 단계 (1 ~ N)
[완성된 테스트 코드]

## 중단된 단계 (N+1)
- 실패 이유: [요소명 / 셀렉터] 를 찾지 못함
- 이후 단계: 요소 확인 후 진행 필요
```
