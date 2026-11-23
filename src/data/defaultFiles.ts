import { PythonFile } from '../types/ide';

export type SnippetCategoryId = 'all' | 'fun' | 'game' | 'crawler' | 'data' | 'tool' | 'android';

export interface SnippetTemplate {
  id: string;
  title: string;
  filename: string;
  category: Exclude<SnippetCategoryId, 'all'>;
  desc: string;
  code: string;
}

export const SNIPPET_CATEGORIES: { id: SnippetCategoryId; labelKey: string }[] = [
  { id: 'all', labelKey: 'tpl_cat_all' },
  { id: 'fun', labelKey: 'tpl_cat_fun' },
  { id: 'game', labelKey: 'tpl_cat_game' },
  { id: 'crawler', labelKey: 'tpl_cat_crawler' },
  { id: 'data', labelKey: 'tpl_cat_data' },
  { id: 'tool', labelKey: 'tpl_cat_tool' },
  { id: 'android', labelKey: 'tpl_cat_android' },
];

export const DEFAULT_FILES: PythonFile[] = [
  {
    id: 'main-py',
    name: 'main.py',
    updatedAt: Date.now(),
    content: `import sys
import droid
from utils import format_device_report

def main():
    print("DroidPy 行動開發環境啟動成功")
    print(f"Python 核心版本: {sys.version.split()[0]}")
    print("-" * 40)

    # 讀取當前 Android / 瀏覽器裝置資訊
    info = droid.device_info()
    print(format_device_report(info))

    # 觸發短震動回饋（在支援震動的 Android 裝置上有效）
    droid.vibrate(40)
    droid.toast("main.py 執行完成")

if __name__ == "__main__":
    main()
`,
  },
  {
    id: 'utils-py',
    name: 'utils.py',
    updatedAt: Date.now() - 1000 * 60 * 5,
    content: `def format_device_report(info: dict) -> str:
    """格式化裝置硬體與螢幕參數為整齊報表"""
    lines = [
        f"作業平台 : {info.get('platform', 'Android')}",
        f"螢幕解析度: {info.get('screen', 'N/A')}",
        f"觸控支援 : {info.get('maxTouchPoints', 0)} 點觸控",
        f"網路連線 : {'線上' if info.get('online') else '離線模式'}",
    ]
    return "\\n".join(lines)


if __name__ == "__main__":
    import droid
    print("[utils.py 獨立測試] 裝置報表輸出：")
    print(format_device_report(droid.device_info()))
`,
  },
  {
    id: 'chart-demo-py',
    name: 'chart_demo.py',
    updatedAt: Date.now() - 1000 * 60 * 12,
    content: `import math
try:
    import matplotlib.pyplot as plt
except ModuleNotFoundError:
    print("提示：目前「Python 直譯器」尚未安裝 matplotlib。")
    print("您可在設定啟用「Pyodide 沙盒附加功能」後繪製互動圖表，或於「工具箱 → 套件」安裝。")
    raise SystemExit(0)

# 產生感測器訊號模擬波形圖
t = [i * 0.1 for i in range(100)]
signal_a = [math.sin(x) * math.exp(-0.08 * x) for x in t]
signal_b = [math.cos(x * 1.4) * 0.6 for x in t]

plt.figure(figsize=(6.4, 3.6), dpi=130)
plt.plot(t, signal_a, color="#10B981", linewidth=2.2, label="Accelerometer X")
plt.plot(t, signal_b, color="#F59E0B", linewidth=1.8, linestyle="--", label="Gyroscope Z")
plt.title("Android Sensor Waveform")
plt.xlabel("Time (s)")
plt.ylabel("Amplitude")
plt.grid(True, alpha=0.25)
plt.legend()
plt.tight_layout()
plt.show()
print("圖表已輸出至終端機檢視區")
`,
  },
  {
    id: 'interactive-py',
    name: 'interactive_cli.py',
    updatedAt: Date.now() - 1000 * 60 * 25,
    content: `# 互動式輸入示範：執行後請在終端機下方輸入數值
def analyze_numbers():
    name = input("請輸入您的開發者代號: ")
    raw = input("請輸入一組逗號分隔的數字 (例如 12,45,88,23): ")

    nums = [float(x.strip()) for x in raw.split(",") if x.strip()]
    if not nums:
        print("未偵測到有效數字")
        return

    avg = sum(nums) / len(nums)
    print(f"\\n你好, {name}！")
    print(f"筆數: {len(nums)} | 總和: {sum(nums):.2f} | 平均: {avg:.2f}")
    print(f"最大值: {max(nums):.2f} | 最小值: {min(nums):.2f}")

analyze_numbers()
`,
  },
];

export const SNIPPET_TEMPLATES: SnippetTemplate[] = [
  {
    id: 'matrix-rain',
    title: '駭客任務數位雨矩陣',
    filename: 'matrix_rain.py',
    category: 'fun',
    desc: '在終端機繪製動態落下的翠綠數位矩陣雨特效，免任何第三方套件。',
    code: `import random
import time

WIDTH = 38
FRAMES = 18
CHARS = "01アイウエオカキクケコDROIDPY#@*+"

drops = [random.randint(-12, 0) for _ in range(WIDTH)]

print("=== DroidPy Matrix Digital Rain ===")
for frame in range(FRAMES):
    line_chars = []
    for col in range(WIDTH):
        pos = drops[col]
        if pos >= 0 and random.random() < 0.85:
            line_chars.append(random.choice(CHARS))
        else:
            line_chars.append(" ")
        drops[col] = pos + 1 if pos < 14 else random.randint(-8, 0)
    print("".join(line_chars))
    time.sleep(0.08)

print("=== 矩陣掃描完畢 ===")
`,
  },
  {
    id: 'mandelbrot-ascii',
    title: '曼德布羅碎形 ASCII 藝術',
    filename: 'mandelbrot_ascii.py',
    category: 'fun',
    desc: '以純數學複數疊代在手機終端機渲染高對比 Mandelbrot 碎形圖案。',
    code: `PALETTE = " .:-=+*#%@"

def render_mandelbrot(width=52, height=22, max_iter=36):
    lines = []
    for row in range(height):
        y0 = -1.15 + (2.3 * row) / (height - 1)
        chars = []
        for col in range(width):
            x0 = -2.1 + (2.8 * col) / (width - 1)
            x = y = 0.0
            it = 0
            while x * x + y * y <= 4.0 and it < max_iter:
                x, y = x * x - y * y + x0, 2 * x * y + y0
                it += 1
            idx = int((it / max_iter) * (len(PALETTE) - 1))
            chars.append(PALETTE[idx])
        lines.append("".join(chars))
    return "\\n".join(lines)

if __name__ == "__main__":
    print("=== Mandelbrot Fractal (52x22) ===")
    print(render_mandelbrot())
`,
  },
  {
    id: 'conway-life',
    title: '康威生命遊戲演化模擬',
    filename: 'life_conway.py',
    category: 'fun',
    desc: '模擬經典滑翔機 (Glider) 與振盪器在二維細胞網格中的繁衍與消長。',
    code: `import time

ROWS, COLS = 12, 26

def step(grid):
    nxt = [[0] * COLS for _ in range(ROWS)]
    for r in range(ROWS):
        for c in range(COLS):
            neighbors = 0
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    if dr == 0 and dc == 0:
                        continue
                    neighbors += grid[(r + dr) % ROWS][(c + dc) % COLS]
            if grid[r][c] == 1 and neighbors in (2, 3):
                nxt[r][c] = 1
            elif grid[r][c] == 0 and neighbors == 3:
                nxt[r][c] = 1
    return nxt

def draw(gen, grid):
    alive = sum(sum(row) for row in grid)
    print(f"--- 第 {gen:02d} 代 (存活細胞: {alive}) ---")
    for row in grid:
        print("".join("■" if cell else "·" for cell in row))

grid = [[0] * COLS for _ in range(ROWS)]
# Glider 圖案
for r, c in [(1, 2), (2, 3), (3, 1), (3, 2), (3, 3), (6, 16), (6, 17), (6, 18)]:
    grid[r][c] = 1

for gen in range(1, 9):
    draw(gen, grid)
    grid = step(grid)
    time.sleep(0.12)
`,
  },
  {
    id: 'maze-solver',
    title: '迷宮自動生成與最短路徑尋路',
    filename: 'maze_generator.py',
    category: 'fun',
    desc: '使用 DFS 演算法隨機建造迷宮，再用 BFS 演算法自動找出起點到終點最佳路徑。',
    code: `import random
from collections import deque

W, H = 13, 9  # 必須為奇數

def generate_maze(w, h):
    maze = [["#" for _ in range(w)] for _ in range(h)]
    def carve(r, c):
        maze[r][c] = " "
        dirs = [(0, 2), (2, 0), (0, -2), (-2, 0)]
        random.shuffle(dirs)
        for dr, dc in dirs:
            nr, nc = r + dr, c + dc
            if 0 < nr < h - 1 and 0 < nc < w - 1 and maze[nr][nc] == "#":
                maze[r + dr // 2][c + dc // 2] = " "
                carve(nr, nc)
    carve(1, 1)
    return maze

def solve_bfs(maze, start, goal):
    q = deque([(start, [start])])
    seen = {start}
    while q:
        (r, c), path = q.popleft()
        if (r, c) == goal:
            return path
        for dr, dc in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
            nr, nc = r + dr, c + dc
            if (nr, nc) not in seen and maze[nr][nc] == " ":
                seen.add((nr, nc))
                q.append(((nr, nc), path + [(nr, nc)]))
    return []

maze = generate_maze(W, H)
start, goal = (1, 1), (H - 2, W - 2)
path = solve_bfs(maze, start, goal)
for r, c in path:
    maze[r][c] = "·"
maze[start[0]][start[1]] = "S"
maze[goal[0]][goal[1]] = "E"

print(f"迷宮尺寸 {W}x{H} | BFS 最短路徑步數: {len(path)}")
for row in maze:
    print(" ".join(row))
`,
  },
  {
    id: 'blackjack-21',
    title: '互動 21 點撲克牌遊戲',
    filename: 'blackjack_21.py',
    category: 'game',
    desc: '支援要牌 / 停牌與莊家 AI 補牌規則的終端互動撲克對戰。',
    code: `import random

SUITS = ["♠", "♥", "♦", "♣"]
RANKS = [("A", 11), ("2", 2), ("3", 3), ("4", 4), ("5", 5), ("6", 6),
         ("7", 7), ("8", 8), ("9", 9), ("10", 10), ("J", 10), ("Q", 10), ("K", 10)]

def hand_score(cards):
    total = sum(val for _, val in cards)
    aces = sum(1 for name, _ in cards if name.endswith("A"))
    while total > 21 and aces:
        total -= 10
        aces -= 1
    return total

def fmt(cards):
    return " ".join(name for name, _ in cards)

deck = [(f"{s}{r}", v) for s in SUITS for r, v in RANKS]
random.shuffle(deck)

player = [deck.pop(), deck.pop()]
dealer = [deck.pop(), deck.pop()]

print("=== 歡迎來到 DroidPy 21 點牌桌 ===")
while hand_score(player) < 21:
    print(f"你的手牌: {fmt(player)} (點數: {hand_score(player)})")
    print(f"莊家明牌: {dealer[0][0]} [??]")
    choice = input("要牌請輸入 y，停牌請輸入 n: ").strip().lower()
    if choice == "y":
        player.append(deck.pop())
    else:
        break

p_score = hand_score(player)
print(f"\\n你的最終手牌: {fmt(player)} -> {p_score} 點")
if p_score > 21:
    print("爆牌了！本局莊家獲勝。")
else:
    while hand_score(dealer) < 17:
        dealer.append(deck.pop())
    d_score = hand_score(dealer)
    print(f"莊家手牌: {fmt(dealer)} -> {d_score} 點")
    if d_score > 21 or p_score > d_score:
        print("恭喜你贏得本局！")
    elif p_score == d_score:
        print("平手！")
    else:
        print("莊家點數較高，再接再厲！")
`,
  },
  {
    id: 'guess-ai',
    title: 'AI 二分搜尋猜數字對決',
    filename: 'number_guess_ai.py',
    category: 'game',
    desc: '包含互動猜數字挑戰，與內建 AI 自動二分逼近解題示範。',
    code: `import random

secret = random.randint(1, 100)
print("=== 1~100 終極密碼對決 ===")
tries = 0
while tries < 7:
    raw = input(f"[第 {tries + 1}/7 次] 請輸入 1~100 整數 (輸入 q 交給 AI 自動破解): ").strip()
    if raw.lower() == "q":
        lo, hi, ai_tries = 1, 100, 0
        while lo <= hi:
            mid = (lo + hi) // 2
            ai_tries += 1
            print(f"  AI 第 {ai_tries} 猜: {mid}")
            if mid == secret:
                print(f"AI 只花 {ai_tries} 次就命中答案 {secret}！")
                break
            elif mid < secret:
                lo = mid + 1
            else:
                hi = mid - 1
        break
    if not raw.isdigit():
        print("請輸入有效整數！")
        continue
    guess = int(raw)
    tries += 1
    if guess == secret:
        print(f"太強了！你在第 {tries} 次猜中 {secret}！")
        break
    print("太小了，往大一點猜！" if guess < secret else "太大了，往小一點猜！")
else:
    print(f"次數用盡！正確答案是 {secret}。")
`,
  },
  {
    id: 'wordle-cli',
    title: 'Wordle 五字母猜詞遊戲',
    filename: 'wordle_cli.py',
    category: 'game',
    desc: '經典 5 字母英文單字推理遊戲，標記完全命中(●)、位置錯(◐)與未出現(○)。',
    code: `import random

WORDS = ["APPLE", "BRAIN", "CLOUD", "DELTA", "EMBER", "FLASK", "GRAPE", "LIGHT", "PIXEL", "STACK"]
target = random.choice(WORDS)

print("=== DroidPy Wordle 挑戰 (5 字母英文單字) ===")
print("圖例: [A]● 位置與字母完全正確 | (A)◐ 有此字母但位置錯 | A○ 不存在")

for turn in range(1, 7):
    guess = input(f"第 {turn}/6 回合，請輸入 5 個英文字母: ").strip().upper()
    if len(guess) != 5 or not guess.isalpha():
        print("請輸入剛好 5 個英文字母！")
        continue
    marks = []
    for i, ch in enumerate(guess):
        if ch == target[i]:
            marks.append(f"[{ch}]●")
        elif ch in target:
            marks.append(f"({ch})◐")
        else:
            marks.append(f"{ch}○")
    print("結果:", "  ".join(marks))
    if guess == target:
        print(f"恭喜！第 {turn} 回合破解單字 {target}！")
        break
else:
    print(f"挑戰結束，正確單字是: {target}")
`,
  },
  {
    id: 'web-crawler',
    title: '網路爬蟲範例 (Termux / APK)',
    filename: 'crawler_demo.py',
    category: 'crawler',
    desc: '搭配 Termux 原生引擎或獨立 APK 執行，無瀏覽器 CORS 限制，支援 requests + BeautifulSoup。',
    code: `# 建議切換至「Termux 原生引擎」或打包後的獨立 APK 執行（無瀏覽器跨域限制）
# 如尚未安裝套件，可在終端機輸入: pip install requests beautifulsoup4
import json
import urllib.request

try:
    import requests
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

URL = "https://quotes.toscrape.com/"

def run_crawler():
    print(f"開始抓取目標網站: {URL}")
    if HAS_BS4:
        resp = requests.get(URL, timeout=15, headers={"User-Agent": "DroidPy-Crawler/1.0"})
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        items = []
        for card in soup.select(".quote")[:5]:
            text = card.select_one(".text").get_text(strip=True)
            author = card.select_one(".author").get_text(strip=True)
            items.append({"author": author, "quote": text})
            print(f"- {author}: {text[:50]}...")

        with open("quotes_output.json", "w", encoding="utf-8") as fp:
            json.dump(items, fp, ensure_ascii=False, indent=2)
        print(f"\\n爬蟲完成，已儲存 {len(items)} 筆資料至 quotes_output.json")
    else:
        print("尚未安裝 requests / beautifulsoup4，改用內建 urllib 示範連線：")
        with urllib.request.urlopen(URL, timeout=15) as res:
            html = res.read().decode("utf-8", errors="replace")
            print(f"HTTP 狀態: {res.status} | 網頁長度: {len(html)} 字元")
            print("提示：請在 Termux 模式執行 pip install requests beautifulsoup4 以啟用完整解析。")

if __name__ == "__main__":
    run_crawler()
`,
  },
  {
    id: 'rss-tech-news',
    title: '即時 Hacker News 科技熱榜抓取',
    filename: 'rss_tech_news.py',
    category: 'crawler',
    desc: '零第三方套件直接使用標準庫抓取 Hacker News Top Stories JSON API 並排行顯示。',
    code: `import json
import urllib.request

TOP_URL = "https://hacker-news.firebaseio.com/v0/topstories.json"
ITEM_URL = "https://hacker-news.firebaseio.com/v0/item/{id}.json"

def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "DroidPy-News/1.0"})
    with urllib.request.urlopen(req, timeout=12) as resp:
        return json.loads(resp.read().decode("utf-8"))

def main():
    print("正在連線 Hacker News API 讀取即時科技熱榜...")
    ids = fetch_json(TOP_URL)[:8]
    for rank, story_id in enumerate(ids, 1):
        story = fetch_json(ITEM_URL.format(id=story_id))
        title = story.get("title", "(無標題)")
        score = story.get("score", 0)
        link = story.get("url", f"https://news.ycombinator.com/item?id={story_id}")
        print(f"{rank}. [{score}★] {title}")
        print(f"   {link}")

if __name__ == "__main__":
    main()
`,
  },
  {
    id: 'algo-sort',
    title: '演算法效能基準測試',
    filename: 'benchmark.py',
    category: 'data',
    desc: '比較內建 Timsort 與自訂快速排序在 5,000 筆資料的耗時。',
    code: `import random
import time

def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

data = [random.randint(1, 100000) for _ in range(5000)]

t0 = time.perf_counter()
res1 = sorted(data)
t1 = time.perf_counter()

t2 = time.perf_counter()
res2 = quicksort(data)
t3 = time.perf_counter()

assert res1 == res2
print(f"資料筆數: {len(data):,}")
print(f"Python sorted(): {(t1 - t0) * 1000:.2f} ms")
print(f"QuickSort      : {(t3 - t2) * 1000:.2f} ms")
`,
  },
  {
    id: 'csv-analyzer',
    title: 'CSV 銷售報表統計與長條圖',
    filename: 'csv_analyzer.py',
    category: 'data',
    desc: '自動建立範例銷售 CSV 檔案並執行品類分組統計與終端橫條圖視覺化。',
    code: `import csv
from collections import defaultdict

CSV_PATH = "sales_sample.csv"
SAMPLE_ROWS = [
    ["月份", "品類", "金額"],
    ["2026-09", "手機配件", "18400"],
    ["2026-09", "開發書籍", "6200"],
    ["2026-10", "手機配件", "24100"],
    ["2026-10", "雲端服務", "15800"],
    ["2026-11", "開發書籍", "9400"],
    ["2026-11", "雲端服務", "27500"],
]

with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows(SAMPLE_ROWS)

totals = defaultdict(int)
with open(CSV_PATH, "r", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        totals[row["品類"]] += int(row["金額"])

max_val = max(totals.values())
print(f"已分析 {CSV_PATH}，各品類總營收：")
for cat, val in sorted(totals.items(), key=lambda x: x[1], reverse=True):
    bar = "█" * max(1, int((val / max_val) * 24))
    print(f"{cat:<8} | {bar:<24} NT$ {val:,}")
`,
  },
  {
    id: 'heart-rose-plot',
    title: '數學極座標玫瑰與愛心曲線',
    filename: 'sine_heart_plot.py',
    category: 'data',
    desc: '在 Pyodide 沙盒繪製高解析愛心圖表，Termux 無 matplotlib 時自動改畫 ASCII 愛心。',
    code: `import math

def print_ascii_heart():
    for y in range(13, -13, -1):
        row = []
        for x in range(-30, 30):
            nx, ny = x * 0.045, y * 0.1
            val = (nx * nx + ny * ny - 1) ** 3 - (nx * nx) * (ny ** 3)
            row.append("♥" if val <= 0 else " ")
        print("".join(row))

try:
    import matplotlib.pyplot as plt
    t = [i * 0.02 for i in range(0, 315)]
    x = [16 * (math.sin(k) ** 3) for k in t]
    y = [13 * math.cos(k) - 5 * math.cos(2 * k) - 2 * math.cos(3 * k) - math.cos(4 * k) for k in t]
    plt.figure(figsize=(5, 4.6), dpi=130)
    plt.fill(x, y, color="#F43F5E", alpha=0.88)
    plt.title("Parametric Heart Curve")
    plt.axis("equal")
    plt.grid(True, alpha=0.2)
    plt.show()
    print("數學愛心圖表繪製完成！")
except ModuleNotFoundError:
    print("目前未安裝 matplotlib，改用終端 ASCII 愛心輸出：")
    print_ascii_heart()
`,
  },
  {
    id: 'pomodoro-timer',
    title: '終端番茄鐘專注計時器',
    filename: 'pomodoro_focus.py',
    category: 'tool',
    desc: '可自訂秒數的即時進度條倒數計時器，結束時呼叫 droid.vibrate() 震動提醒。',
    code: `import time
import droid

raw = input("請輸入專注倒數秒數 (預設 10 秒快速測試): ").strip()
seconds = int(raw) if raw.isdigit() and int(raw) > 0 else 10

print(f"開始 {seconds} 秒專注計時...")
for remain in range(seconds, -1, -1):
    done = seconds - remain
    bar_len = 20
    filled = int((done / seconds) * bar_len)
    bar = "#" * filled + "-" * (bar_len - filled)
    print(f"[{bar}] 剩餘 {remain:02d} 秒", end="\\r", flush=True)
    if remain > 0:
        time.sleep(1)

print("\\n計時完成！休息一下喝口水吧。")
droid.vibrate([80, 60, 120])
droid.toast("番茄鐘計時結束")
`,
  },
  {
    id: 'password-studio',
    title: '高強度隨機密碼產生與熵值分析',
    filename: 'password_studio.py',
    category: 'tool',
    desc: '使用密碼學安全 secrets 模組產生隨機密碼，並計算位元熵 (Entropy) 安全評等。',
    code: `import math
import secrets
import string

def generate_password(length=16, symbols=True):
    pool = string.ascii_letters + string.digits + ("!@#$%^&*()-_=+" if symbols else "")
    while True:
        pwd = "".join(secrets.choice(pool) for _ in range(length))
        if (any(c.islower() for c in pwd) and any(c.isupper() for c in pwd)
                and any(c.isdigit() for c in pwd)):
            entropy = length * math.log2(len(pool))
            return pwd, entropy

print("=== DroidPy 安全密碼產生器 ===")
for idx in range(1, 6):
    pwd, bits = generate_password(18, symbols=True)
    grade = "極高強度" if bits >= 100 else "高強度"
    print(f"{idx}. {pwd}  ({bits:.1f} bits · {grade})")
`,
  },
  {
    id: 'qr-ascii',
    title: 'QR Code 二維碼終端生成器',
    filename: 'qr_ascii_art.py',
    category: 'tool',
    desc: '優先使用 qrcode 套件輸出高對比 Unicode 方塊 QR 碼；未安裝時提供下載提示。',
    code: `text = input("請輸入要轉換成 QR Code 的網址或文字 (預設 https://github.com): ").strip()
if not text:
    text = "https://github.com"

try:
    import qrcode
    qr = qrcode.QRCode(border=1)
    qr.add_data(text)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    print(f"\\n目標內容: {text}\\n")
    for row in matrix:
        print("".join("██" if cell else "  " for cell in row))
except ModuleNotFoundError:
    print("尚未安裝 qrcode 套件！請於「套件管理」搜尋並安裝 qrcode。")
    print("支援 Pyodide 沙盒與 Termux pip install qrcode。")
`,
  },
  {
    id: 'mini-http-api',
    title: '本機微型 HTTP JSON API 伺服器',
    filename: 'mini_http_server.py',
    category: 'tool',
    desc: '零依賴啟動一個可回應 JSON 的本機測試 Web API（適合在 Termux 原生引擎執行）。',
    code: `# 建議在「Termux 原生引擎」執行，啟動後可在瀏覽器開啟 http://127.0.0.1:9090
import json
import platform
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

class DemoApiHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        payload = {
            "service": "DroidPy Mini API",
            "path": self.path,
            "platform": platform.platform(),
            "timestamp": int(time.time()),
        }
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 9090), DemoApiHandler)
    print("Mini HTTP API 已啟動於 http://127.0.0.1:9090 (按頂部停止按鈕可結束)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
`,
  },
  {
    id: 'kivy-android',
    title: 'Kivy Android 介面範本',
    filename: 'kivy_app.py',
    category: 'android',
    desc: '標準 Kivy 行動裝置視窗結構，可搭配 Buildozer 編譯為 APK。',
    code: `# 此範本供匯出至 Android Buildozer / Termux 編譯 APK 使用
from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label

class DroidCounterApp(App):
    def build(self):
        self.count = 0
        layout = BoxLayout(orientation="vertical", padding=24, spacing=16)
        self.label = Label(text="點擊次數: 0", font_size="24sp")
        btn = Button(text="點擊計數 +1", size_hint=(1, 0.3), background_color=(0.06, 0.72, 0.5, 1))
        btn.bind(on_press=self.increment)
        layout.add_widget(self.label)
        layout.add_widget(btn)
        return layout

    def increment(self, _instance):
        self.count += 1
        self.label.text = f"點擊次數: {self.count}"

if __name__ == "__main__":
    DroidCounterApp().run()
`,
  },
  {
    id: 'battery-monitor',
    title: 'Android 電量與震動測試',
    filename: 'battery_check.py',
    category: 'android',
    desc: '透過 droid 模組非同步讀取裝置電池狀態與震動回饋。',
    code: `import asyncio
import droid

async def check_power():
    battery = await droid.battery()
    if battery.get("supported"):
        level = int(battery["level"] * 100)
        charging = "充電中" if battery["charging"] else "使用電池"
        print(f"目前電量: {level}% ({charging})")
        if level > 20:
            droid.vibrate([30, 50, 30])
    else:
        print("此環境不支援 Battery Status API")

asyncio.ensure_future(check_power())
`,
  },
];
