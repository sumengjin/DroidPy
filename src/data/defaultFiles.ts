import { PythonFile } from '../types/ide';

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
    print("提示：目前執行引擎尚未安裝 matplotlib（例如剛初始化的 Termux 原生環境）。")
    print("請將終端機切換為「沙盒 (Pyodide)」直接繪製互動圖表，或於「負屏工具箱 → 套件」安裝。")
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

export const SNIPPET_TEMPLATES: { id: string; title: string; filename: string; desc: string; code: string }[] = [
  {
    id: 'kivy-android',
    title: 'Kivy Android 介面範本',
    filename: 'kivy_app.py',
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
        print("此瀏覽器環境不支援 Battery Status API")

asyncio.ensure_future(check_power())
`,
  },
  {
    id: 'algo-sort',
    title: '演算法效能基準測試',
    filename: 'benchmark.py',
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
    id: 'web-crawler',
    title: '網路爬蟲範例 (Termux / APK)',
    filename: 'crawler_demo.py',
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
];
