# MU Live Tracker — Design Spec

> Ngày: 2026-07-16. Kết quả phiên brainstorming đầu tiên, tiếp nối `HANDOFF.md`.
> Trạng thái: đã duyệt từng phần với user, chờ user review bản viết.

## 1. Mục tiêu & yêu cầu xuyên suốt

Live tracker cho **Manchester United** — mọi trận đấu, mọi giải, mùa hiện tại (kể cả giao hữu).

Hai yêu cầu xuyên suốt, ngang hàng với tính năng:

1. **Learning-first**: dự án là phương tiện để user (không phải FE dev) học sâu bản chất ReactJS. Mọi quyết định kỹ thuật ưu tiên tính tường minh của cơ chế React hơn sự tiện lợi của thư viện.
2. **Chất MU riêng**: user là fan MU 20 năm. UI/UX phải mang bản sắc Manchester United, không phải tracker bóng đá generic.

## 2. Các quyết định đã chốt

| Quyết định | Lựa chọn |
|---|---|
| Phạm vi MVP | **Full**: lịch/kết quả/sắp tới + tỷ số live + standings + match detail có formation pitch |
| Ngôn ngữ code | **TypeScript** (strict) |
| Ngôn ngữ UI | **Tiếng Anh** |
| Deploy | **Chưa** — chạy `next dev` local; quyết định deploy sau khi MVP chạy được |
| API key football-data | Dùng tạm key của repo WC-2026 (đăng ký key riêng sau) |
| Polling live | **Tự viết** `useEffect + setInterval` (hook `usePolling`) — KHÔNG dùng TanStack Query |
| Kiến trúc | **BFF — merge 2 nguồn ở server** (hướng A trong 3 hướng đã cân nhắc) |
| Styling | CSS Modules tự viết, không component library |
| Test | vitest cho `lib/`, React Testing Library cho hooks/components |

## 3. Kiến trúc tổng thể

```
Browser (React client components, usePolling)
   │  fetch /api/matches, /api/standings, /api/match/[id]
   ▼
Next.js Route Handlers — BFF layer (pure TS, có test)
   │  lib/fd.ts ──────► football-data.org v4  (X-Auth-Token, team 66)
   │  lib/espn.ts ────► ESPN unofficial API   (team 360, lặp 8 league slugs)
   │  lib/merge.ts ───  union 2 nguồn
   │  lib/cache.ts ───  content-aware TTL (port cache.mjs từ WC-2026)
   ▼
Unified domain model (Match, Competition, Standing) → JSON về client
```

Nguyên tắc: **client không bao giờ thấy 2 nguồn dữ liệu** — chỉ thấy model thống nhất. Toàn bộ logic đối soát 2 feed (vùng dễ vỡ nhất theo HANDOFF mục 5) nằm trong `lib/` dưới dạng pure function có unit test.

- Cache: in-memory trong server process, TTL content-aware (30s quanh giờ bóng lăn, dài hơn khi không có trận). Đủ cho local dev; cache phân tán tính khi deploy.
- `FOOTBALL_API_KEY` đọc từ `.env.local`, không bao giờ chạm client.
- Season detection: gọi FD `/v4/teams/66/matches` không truyền `season` → FD tự trả mùa hiện tại. Danh sách giải detect động: ESPN slug nào trả schedule rỗng nghĩa là MU không dự giải đó. Fallback heuristic giao mùa: `tháng >= 7 ? năm/năm+1 : (năm-1)/năm`.

### Endpoint BFF

| Endpoint | Trả về | Nguồn |
|---|---|---|
| `GET /api/matches` | Toàn bộ trận MU mùa hiện tại (model thống nhất, nhóm theo competition) + `meta.sources` | FD teams/66/matches ∪ ESPN schedule 8 slugs |
| `GET /api/standings?comp=PL\|CL` | Bảng EPL 20 đội / UCL league phase 36 đội | FD standings (PL, CL) |
| `GET /api/match/[id]` | Chi tiết 1 trận: lineup/formation, scorers, thẻ, live clock | ESPN detail; FD làm nền tỷ số/status |

## 4. Domain model & merge

### Match (lib/types.ts)

```ts
type Match = {
  id: string;                      // "2026-07-19_arsenal" — sinh từ khóa merge, ổn định giữa 2 nguồn
  utcDate: string;
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED';
  competition: CompetitionId;      // 'PL' | 'CL' | 'FA' | 'EFL' | 'FRIENDLY' | ...
  home: Team; away: Team;
  score: {
    fullTime: { home: number|null; away: number|null };
    display:  { home: number|null; away: number|null };  // đã xử lý hiệp phụ/luân lưu
    penalties?: { home: number; away: number };
  };
  minute?: string;                 // live clock từ ESPN
  sources: { fd?: number; espn?: string };  // friendly/FA/EFL chỉ có espn
};
```

### Mapping competition (lib/competitions.ts — bảng tĩnh, có test)

| Nội bộ | football-data | ESPN slug | Standings |
|---|---|---|---|
| `PL` | `PL` | `eng.1` | bảng 20 đội |
| `CL` | `CL` | `uefa.champions` | league phase 36 đội |
| `FA` | — | `eng.fa` | cup run (hành trình vòng đấu) |
| `EFL` | — | `eng.league_cup` | cup run |
| `FRIENDLY` | — | `club.friendly` | không có |
| `EL` / `ECL` / `CWC` (dự phòng) | — | `uefa.europa`, `uefa.europa.conf`, `fifa.cwc` | (thêm khi MU tham dự) |

### Thuật toán merge (lib/merge.ts — pure function)

1. Fetch FD matches + ESPN schedule mọi slug (slug rỗng → MU không dự giải đó mùa này).
2. Khóa ghép = `(ngày UTC ±1 quanh kickoff, tên đối thủ normalize)`. Normalize = Unicode NFD bỏ dấu + lowercase + bỏ hậu tố FC/AFC (bài học commit `e4451ca`).
3. Trùng khóa → merge: **FD làm nền** (status, score chuẩn), **ESPN đè trường enrich** (minute, scorers). Chỉ ESPN → nhận nguyên (friendly, FA, EFL). Chỉ FD → giữ nguyên.
4. Score `display`: port logic `preShootoutScore` WC-2026 — phân biệt `regularTime`/`extraTime`/`fullTime` theo cách trận kết thúc (bài học commit `d4670ba`).

### Formation (lib/formation.ts)

Port nguyên `buildFormationRows`, `playerLine`, bảng `FP_LAT`, xử lý suffix vị trí `-L`/`-R` từ `utils.js` WC-2026, kèm test port theo. Trận friendly thường không có lineup → match detail degrade: chỉ tỷ số + scorers.

## 5. Pages, components, polling

```
app/
  layout.tsx                 # nav tabs: Today | Schedule | Standings; theme MU
  page.tsx                   # Today — trận hôm nay/đang live + trận gần nhất & kế tiếp
  schedule/page.tsx          # toàn mùa, nhóm theo competition, filter tab
  standings/page.tsx         # sub-tabs: EPL | UCL | FA Cup | Carabao
  match/[id]/page.tsx        # match detail: formation pitch, scorers, timeline
  api/matches/route.ts  api/standings/route.ts  api/match/[id]/route.ts
components/
  MatchCard  MatchList  StandingsTable  CupRun  FormationPitch  LiveBadge
hooks/
  usePolling.ts
lib/
  fd.ts  espn.ts  merge.ts  season.ts  competitions.ts  formation.ts  cache.ts  types.ts
```

Tất cả page là **client components** — một mental model duy nhất để học lifecycle (Server Components là bước nâng cấp sau, ngoài phạm vi spec này).

### usePolling — trung tâm bài học lifecycle

`usePolling(fetcher, intervalMs)`: quản lý interval trong `useEffect`, cleanup khi unmount, chống stale closure bằng ref, chịu được StrictMode double-mount. Interval động:

- **30s** khi có trận `IN_PLAY`/`PAUSED`;
- **5 phút** trong cửa sổ ±30 phút quanh kickoff;
- **dừng polling** khi không có trận trong ngày.

Server cache chặn thêm một lớp nên client polling không đốt rate limit FD (10 req/phút).

### Quy tắc clickable (bài học commit `38fe14b`)

MatchCard chỉ link sang match detail khi status `IN_PLAY`/`PAUSED`/`FINISHED`. Trận `TIMED`/`SCHEDULED`/`POSTPONED` không click được. Có test component cho quy tắc này.

## 6. Learning-first (yêu cầu chính thức)

- **Milestone theo khái niệm React**, không chỉ theo tính năng. Lộ trình concept: props/list/key/conditional render (MatchCard, MatchList) → state & lifting state up (tabs) → useEffect/cleanup/stale closure/refs (usePolling) → context (theme) → derived state & memo (FormationPitch).
- **`LEARNING.md`** ở root: sổ tay concept, viết ngay khi code phần liên quan (cơ chế render, tại sao StrictMode mount 2 lần, tại sao cần cleanup...).
- **Teaching comments** đánh dấu `// [React]` tại các điểm mấu chốt phía client — giải thích *tại sao React hành xử vậy*. `lib/` server comment bình thường.
- **Không thư viện che cơ chế**: không TanStack Query, không component library; CSS Modules + hooks thuần.

## 7. Chất MU (yêu cầu chính thức)

- **Theme quỷ đỏ**: nền tối kiểu đêm châu Âu ở Old Trafford; đỏ MU `#DA291C` chủ đạo, vàng/gold highlight, đen sâu; typography đậm chắc.
- **Ngôn ngữ UI mang hồn CLB** (tiếng Anh): header hướng "Theatre of Dreams"; W/D/L theo màu.
- **Fergie Time**: trận live phút 90+ mà MU đang hòa/thua → badge live đổi thành *Fergie Time* (hiệu ứng nhấp nháy).
- **Góc nhìn MU**: card hiển thị "vs Arsenal (H)" thay vì cặp home-away trung lập; form gần nhất W-W-D-L-W.
- Chi tiết visual cụ thể chốt cùng user khi làm layout (có thể dùng visual companion xem mockup).

## 8. Error handling & degradation

- FD lỗi/hết rate limit → vẫn trả trận từ ESPN; response kèm `meta.sources` để UI hiện cảnh báo partial data.
- ESPN lỗi → lịch/tỷ số vẫn đủ từ FD, mất enrich (minute, scorers, formation).
- Friendly không lineup → ẩn FormationPitch, hiện tỷ số + scorers.
- Client fetch lỗi → giữ data cũ + banner retry, không blank page.

## 9. Testing

- **vitest** cho toàn bộ `lib/`: merge, competitions, formation, season, cache — fixture JSON chụp từ API thật trong preseason hiện tại (đang diễn ra, có data thật).
- **React Testing Library**: `usePolling` (fake timers, unmount cleanup, StrictMode), quy tắc clickable của MatchCard, degrade của FormationPitch.

## 10. Ngoài phạm vi (YAGNI)

- Deploy (Vercel/Cloudflare) — quyết sau khi MVP chạy local.
- Server Components / RSC — bước nâng cấp học tập sau MVP.
- Cache phân tán, thông báo push, PWA, đa CLB.
- Port `elimination.js` / `bracket.js` / `campaign.js` từ WC-2026 (đặc thù tournament).
