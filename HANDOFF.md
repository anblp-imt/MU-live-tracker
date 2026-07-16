# HANDOFF — MU Live Tracker

> Tài liệu bàn giao context từ session phân tích `d:\Project\Personal\WC-2026-live-tracker` (2026-07-16).
> Đọc file này trước khi bắt đầu code. Dự án mới KHÔNG chỉnh sửa gì ở repo WC-2026.

## 1. Mục tiêu dự án

Live tracker cho **Manchester United** — theo dõi tất cả trận đấu của MU qua mọi giải trong mùa hiện tại, thay vì tracker cho một giải cố định như dự án WC-2026.

**Yêu cầu đã chốt với user:**
- Detect **mùa giải hiện tại** động theo thời gian thực (không hardcode mùa/giải như WC-2026 hardcode trong `campaign.js`).
- Bao gồm **giao hữu** (preseason tour, v.v.).
- **Ranking tách theo từng giải**: EPL có bảng 20 đội, UCL có bảng league-phase 36 đội (thể thức Thụy Sĩ), FA Cup/Carabao Cup là knockout → không có bảng, hiện dạng "hành trình vòng đấu".
- Stack: **Next.js (App Router) + React** — user không phải FE dev, chọn React để **học lifecycle**; chấp nhận overkill. Khuyến nghị thêm: TanStack Query (React Query) cho polling live, deploy Vercel (API Routes thay Cloudflare Pages Functions).

## 2. Nguồn dữ liệu & ID quan trọng

| Nguồn | Vai trò | Auth |
|---|---|---|
| football-data.org v4 | Xương sống: lịch, tỷ số, standings | Header `X-Auth-Token` (key giấu ở server, free 10 req/phút) |
| ESPN unofficial API | Enrich: đội hình/formation, scorer, thẻ, live clock; VÀ là nguồn duy nhất cho giao hữu + FA Cup/Carabao Cup (không có trong football-data free) | Không cần auth |

**ID Manchester United:** football-data.org = `66`, ESPN = `360`.

**Endpoint then chốt (detect mùa hiện tại):**
- `GET /v4/teams/66/matches` — không truyền `season` thì football-data **tự trả mùa hiện tại**, gồm mọi giải họ cover (mỗi trận có object `competition` để nhóm). Đây là cơ chế detect mùa chính — không cần tự tính.
- ESPN per-league schedule: `/sports/soccer/{league}/teams/360/schedule` — response có object `season` (year, dates) làm nguồn chân lý thứ hai. Giải MU không tham dự → trả rỗng → danh sách giải cũng được detect động.
- ESPN league slugs cần lặp: `eng.1` (EPL), `eng.fa` (FA Cup), `eng.league_cup` (Carabao), `uefa.champions`, `uefa.europa`, `uefa.europa.conf`, `club.friendly` (giao hữu), `fifa.cwc`.
- Fallback heuristic giao mùa: mùa châu Âu chạy T8→T5 ⇒ `tháng >= 7 ? năm/năm+1 : (năm-1)/năm`.

**Standings:**
- `GET /v4/competitions/PL/standings` (free) — bảng EPL 20 đội.
- `GET /v4/competitions/CL/standings` (free) — league phase UCL 36 đội.
- FA Cup / Carabao / giao hữu: không có standings. ESPN cũng có endpoint standings nếu cần đối chiếu.

**Lưu ý giao hữu:** trận `club.friendly` trên ESPN thường **không có lineup/formation chi tiết** → match-detail panel phải degrade nhẹ nhàng (chỉ tỷ số + scorer nếu có). Giao hữu là trận "ESPN-only" — football-data không biết chúng tồn tại.

## 3. Kiến trúc merge 2 nguồn (khác WC-2026)

WC-2026 coi football-data là xương sống, ESPN chỉ enrich. Dự án MU phải **đảo lại thành union**: một trận có thể tồn tại ở cả 2 nguồn (EPL, UCL) hoặc chỉ ESPN (giao hữu, FA Cup, Carabao). Cần model trận thống nhất với `sources: {fd?, espn?}` và khóa ghép = (ngày, đối thủ đã normalize).

## 4. Code tái sử dụng từ WC-2026-live-tracker (~60–70%)

Repo nguồn: `d:\Project\Personal\WC-2026-live-tracker` (vanilla JS, esbuild, Cloudflare Pages). Các phần đáng port (đa số là pure JS không đụng DOM — copy gần nguyên, chỉ đổi render sang React component):

| File nguồn | Nội dung đáng lấy |
|---|---|
| `api.js` | `espnFetch`, `findEspnEvent`, `fetchEspnDetail`, `extractScorers`, `enrichLiveScores` — logic gọi + enrich ESPN |
| `utils.js` | **Phần quý nhất, nhiều bug-fix nhất**: `buildFormationRows`, `playerLine`, bảng `FP_LAT` (lateral placement), xử lý hiệp phụ/luân lưu (`preShootoutScore`: regularTime+extraTime vs fullTime theo finish type), xử lý suffix vị trí ESPN `-L`/`-R`, normalize tên đội Unicode NFD (đội có dấu) |
| `functions/api/[[path]].js` + `functions/api2/[[path]].js` | Pattern proxy giấu key + edge cache → chuyển thành Next.js Route Handlers (`app/api/...`) |
| `functions/_lib/cache.mjs` | Content-aware TTL: cache 30s quanh giờ bóng lăn, dài hơn khi không có trận; có sẵn test |
| `elimination.js`, `bracket.js`, `campaign.js` | **KHÔNG port** — đặc thù tournament (bảng đấu, bracket knockout, toán loại). Dự án club không cần |

## 5. Bài học xương máu từ WC-2026 (các commit fix gần nhất)

Vùng dễ vỡ nhất là **đối soát 2 feed bất đồng thuận**:
1. Match tên đội giữa 2 nguồn phải normalize Unicode NFD (tên có dấu) — commit `e4451ca`.
2. Live detection quanh giờ kickoff cần pre-kickoff probing window + TTL cache ngắn (30s) — cùng commit.
3. ESPN trả position kiểu `CM-L`/`CM-R` — formation render phải strip/dùng suffix — commit `d4670ba`.
4. Tỷ số hiệp phụ: football-data phân biệt `regularTime`/`extraTime`/`fullTime` theo cách kết thúc trận — lấy sai field là sai tỷ số — commit `d4670ba`.
5. Trạng thái clickable của trận theo status (`TIMED`/`SCHEDULED`/`IN_PLAY`/`PAUSED`/`FINISHED`) từng regress — commit `38fe14b`.

Dự án MU thêm một chiều mới: phải map **competition** giữa 2 nguồn (PL↔eng.1, CL↔uefa.champions...), không chỉ map trận. Nên viết bảng mapping tĩnh nhỏ + test.

## 6. Phác thảo cấu trúc Next.js đề xuất

```
mu-live-tracker/
  app/
    layout.tsx, page.tsx          # Today (mặc định)
    results/ upcoming/ schedule/  # các tab (hoặc 1 page + client tabs)
    standings/                    # sub-tab theo giải: EPL / UCL / hành trình cúp
    match/[id]/                   # match detail: formation pitch, timeline
    api/fd/[...path]/route.ts     # proxy football-data (giấu FOOTBALL_API_KEY)
    api/espn/[...path]/route.ts   # proxy ESPN
  lib/
    fd.ts espn.ts                 # client 2 nguồn (port từ api.js)
    merge.ts                      # union 2 nguồn, khóa (ngày, đối thủ)
    season.ts                     # detect mùa hiện tại + danh sách giải động
    formation.ts                  # port buildFormationRows/playerLine/FP_LAT
    competitions.ts               # mapping PL↔eng.1, CL↔uefa.champions, ...
  components/                     # MatchCard, StandingsTable, FormationPitch, Timeline...
```

- Server Components: lịch, standings (fetch server-side, revalidate).
- Client Components + React Query `refetchInterval`: tỷ số live, live clock.
- Env: `FOOTBALL_API_KEY` (lấy key riêng, đừng dùng chung key với repo WC nếu chạy song song — rate limit 10 req/phút tính theo key).

## 7. Câu hỏi mở cho phiên brainstorming đầu tiên

- Phạm vi MVP: chỉ lịch + tỷ số live + standings trước, formation pitch làm sau?
- Mùa 2026–27 bắt đầu ~T8/2026 (preseason từ giữa T7) — timeline có nhắm kịp preseason không? (Hôm nay là 16/7/2026 — preseason có thể đã bắt đầu, tức có data thật để test ngay.)
- TypeScript hay JS? (Khuyến nghị TS — học React 2026 nên đi kèm TS, và port code cũ sang TS là bài tập đọc hiểu tốt.)
- Deploy: Vercel (khuyến nghị, tự nhiên với Next.js) hay ở lại Cloudflare (cần OpenNext adapter).
