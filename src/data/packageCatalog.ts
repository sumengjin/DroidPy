export type PackageCategoryId =
  | 'all'
  | 'crawler'
  | 'data'
  | 'media'
  | 'web'
  | 'niche'
  | 'system';

export type PackageTier = 'popular' | 'niche';

export interface CatalogPackageItem {
  id: string;
  name: string;
  category: Exclude<PackageCategoryId, 'all'>;
  tier: PackageTier;
  desc: string;
  runtimeHint: string;
  aliases: string[];
  pyodide?: {
    supported: boolean;
    packageName?: string;
  };
  termux?: {
    mode: 'pip' | 'pkg';
    targetName: string;
  };
}

export const PACKAGE_CATEGORIES: { id: PackageCategoryId; labelKey: string }[] = [
  { id: 'all', labelKey: 'pkg_cat_all' },
  { id: 'crawler', labelKey: 'pkg_cat_crawler' },
  { id: 'data', labelKey: 'pkg_cat_data' },
  { id: 'media', labelKey: 'pkg_cat_media' },
  { id: 'web', labelKey: 'pkg_cat_web' },
  { id: 'niche', labelKey: 'pkg_cat_niche' },
  { id: 'system', labelKey: 'pkg_cat_system' },
];

export const TERMUX_PKG_NAME_HINTS: Record<string, { suggestedMode: 'pkg' | 'pip'; suggestedTarget: string; reason: string }> = {
  matplotlib: {
    suggestedMode: 'pkg',
    suggestedTarget: 'matplotlib',
    reason: 'Termux 提供原生 matplotlib 套件，避免 pip 在 Android 上編譯 matplotlib／contourpy 等原生依賴。',
  },
  pandas: {
    suggestedMode: 'pkg',
    suggestedTarget: 'python-pandas',
    reason: 'Termux 預編譯 pandas 可避免手機從原始碼編譯 NumPy／pandas 相依套件。',
  },
  numpy: {
    suggestedMode: 'pkg',
    suggestedTarget: 'python-numpy',
    reason: 'Termux 官方預編譯 NumPy 套件名稱為 python-numpy，可直接免編譯安裝。',
  },
  pillow: {
    suggestedMode: 'pkg',
    suggestedTarget: 'python-pillow',
    reason: 'Termux 官方預編譯 Pillow 名稱為 python-pillow，免去從原始碼編譯 C 庫。',
  },
  pil: {
    suggestedMode: 'pkg',
    suggestedTarget: 'python-pillow',
    reason: 'PIL / Pillow 在 Termux APT 的正式套件名稱為 python-pillow。',
  },
  lxml: {
    suggestedMode: 'pkg',
    suggestedTarget: 'python-lxml',
    reason: 'Termux 預編譯高速 XML/HTML 解析器名稱為 python-lxml。',
  },
  cryptography: {
    suggestedMode: 'pkg',
    suggestedTarget: 'python-cryptography',
    reason: 'Termux 預編譯 cryptography（含 Rust 模組）套件名為 python-cryptography。',
  },
  polars: {
    suggestedMode: 'pip',
    suggestedTarget: 'polars',
    reason: 'Polars 的 Android Rust 執行模組改由已簽署的 Termux User Repository（TUR）預編譯套件提供；一鍵安裝會先加入 TUR，再安裝 python-polars。',
  },
  'scikit-learn': {
    suggestedMode: 'pip',
    suggestedTarget: 'scikit-learn',
    reason: '目前未找到官方 Termux ARM64／Python 3.14 預編譯套件；DroidPy 不會在手機上自動編譯，待相容預編譯版本通過測試後再開放。',
  },
};

export const PACKAGE_CATALOG: CatalogPackageItem[] = [
  // === 爬蟲與網路 (Crawler & Network) ===
  {
    id: 'requests',
    name: 'requests',
    category: 'crawler',
    tier: 'popular',
    desc: '最經典的 HTTP 網路請求與 Session Cookie 爬蟲核心',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['http', 'req', 'crawler', 'session'],
    pyodide: { supported: true, packageName: 'requests' },
    termux: { mode: 'pip', targetName: 'requests' },
  },
  {
    id: 'beautifulsoup4',
    name: 'beautifulsoup4',
    category: 'crawler',
    tier: 'popular',
    desc: '網頁 HTML / XML 結構解析與 CSS 選擇器擷取',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['bs4', 'beautifulsoup', 'soup', 'html'],
    pyodide: { supported: true, packageName: 'beautifulsoup4' },
    termux: { mode: 'pip', targetName: 'beautifulsoup4' },
  },
  {
    id: 'httpx',
    name: 'httpx',
    category: 'crawler',
    tier: 'popular',
    desc: '支援 HTTP/2 與 asyncio 非同步的高效能爬蟲客戶端',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['async http', 'http2', 'h2'],
    pyodide: { supported: true, packageName: 'httpx' },
    termux: { mode: 'pip', targetName: 'httpx' },
  },
  {
    id: 'python-lxml',
    name: 'python-lxml',
    category: 'crawler',
    tier: 'popular',
    desc: '超高速 C 語言 XPath / HTML 解析引擎（Termux 預編譯）',
    runtimeHint: 'Termux pkg 預編譯 / 沙盒 WASM 為 lxml',
    aliases: ['lxml', 'xpath', 'xml'],
    pyodide: { supported: true, packageName: 'lxml' },
    termux: { mode: 'pkg', targetName: 'python-lxml' },
  },
  {
    id: 'aiohttp',
    name: 'aiohttp',
    category: 'crawler',
    tier: 'popular',
    desc: '非同步 HTTP Client / Server 框架，適合高併發爬蟲',
    runtimeHint: '沙盒 WASM / Termux pip',
    aliases: ['async', 'websocket'],
    pyodide: { supported: true, packageName: 'aiohttp' },
    termux: { mode: 'pip', targetName: 'aiohttp' },
  },
  {
    id: 'parsel',
    name: 'parsel',
    category: 'crawler',
    tier: 'niche',
    desc: 'Scrapy 底層的輕量 CSS / XPath / 正則擷取器',
    runtimeHint: 'Termux 先安裝原生 python-lxml，w3lib 2.6 使用 DroidPy 內建純 Python Frostwork 相容層，無須 Rust/Maturin',
    aliases: ['scrapy', 'cssselect', 'xpath'],
    pyodide: { supported: true, packageName: 'parsel' },
    termux: { mode: 'pip', targetName: 'parsel' },
  },
  {
    id: 'selectolax',
    name: 'selectolax',
    category: 'crawler',
    tier: 'niche',
    desc: '比 BeautifulSoup 快 10 倍的極速 HTML5 解析器',
    runtimeHint: 'Termux 建議已安裝 clang 後安裝',
    aliases: ['modest', 'lexbor', 'html5'],
    pyodide: { supported: false },
    termux: { mode: 'pip', targetName: 'selectolax' },
  },
  {
    id: 'trafilatura',
    name: 'trafilatura',
    category: 'crawler',
    tier: 'niche',
    desc: '自動抽取新聞網頁正文、標題與中繼資料（排除廣告選單）',
    runtimeHint: 'Termux pip（先裝 python-lxml 更穩）',
    aliases: ['article', 'extractor', 'readability', 'news'],
    pyodide: { supported: false },
    termux: { mode: 'pip', targetName: 'trafilatura' },
  },
  {
    id: 'cloudscraper',
    name: 'cloudscraper',
    category: 'crawler',
    tier: 'niche',
    desc: '繞過常見前端 JS 驗證頁的 requests 相容封裝庫',
    runtimeHint: '純 Python / Termux pip',
    aliases: ['cf', 'cloudflare', 'bypass'],
    pyodide: { supported: true, packageName: 'cloudscraper' },
    termux: { mode: 'pip', targetName: 'cloudscraper' },
  },
  {
    id: 'fake-useragent',
    name: 'fake-useragent',
    category: 'crawler',
    tier: 'niche',
    desc: '動態產生真實瀏覽器 User-Agent 標頭降低反爬封鎖',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['ua', 'useragent', 'headers'],
    pyodide: { supported: true, packageName: 'fake-useragent' },
    termux: { mode: 'pip', targetName: 'fake-useragent' },
  },
  {
    id: 'feedparser',
    name: 'feedparser',
    category: 'crawler',
    tier: 'niche',
    desc: '解析 RSS / Atom 新聞訂閱與 Podcast Feed',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['rss', 'atom', 'podcast'],
    pyodide: { supported: true, packageName: 'feedparser' },
    termux: { mode: 'pip', targetName: 'feedparser' },
  },
  {
    id: 'curl-cffi',
    name: 'curl-cffi',
    category: 'crawler',
    tier: 'niche',
    desc: '模擬瀏覽器 TLS 指紋的進階爬蟲 HTTP 庫',
    runtimeHint: 'Termux pip（部分裝置需 clang / cmake）',
    aliases: ['tls', 'ja3', 'curl'],
    pyodide: { supported: false },
    termux: { mode: 'pip', targetName: 'curl-cffi' },
  },

  // === 科學與數據 (Data Science & Math) ===
  {
    id: 'numpy',
    name: 'numpy',
    category: 'data',
    tier: 'popular',
    desc: 'Python 數值陣列、線性代數與矩陣運算基石',
    runtimeHint: '沙盒 WASM 預編譯 / Termux 對應 python-numpy',
    aliases: ['np', 'python-numpy', 'matrix', 'array'],
    pyodide: { supported: true, packageName: 'numpy' },
    termux: { mode: 'pkg', targetName: 'python-numpy' },
  },
  {
    id: 'pandas',
    name: 'pandas',
    category: 'data',
    tier: 'popular',
    desc: '強大的 CSV / Excel 表格清洗、分組與時間序列分析',
    runtimeHint: '沙盒 WASM 預編譯 / Termux 使用預編譯 python-pandas，避免在手機上編譯 NumPy／pandas',
    aliases: ['pd', 'dataframe', 'csv', 'excel'],
    pyodide: { supported: true, packageName: 'pandas' },
    termux: { mode: 'pkg', targetName: 'python-pandas' },
  },
  {
    id: 'matplotlib',
    name: 'matplotlib',
    category: 'data',
    tier: 'popular',
    desc: '折線圖、長條圖與感測器波形圖繪製工具',
    runtimeHint: '沙盒 WASM 直接於終端內嵌顯示圖表 / Termux 使用預編譯 matplotlib，避免手機編譯 contourpy 等原生依賴',
    aliases: ['plt', 'plot', 'chart', 'pyplot'],
    pyodide: { supported: true, packageName: 'matplotlib' },
    termux: { mode: 'pkg', targetName: 'matplotlib' },
  },
  {
    id: 'scipy',
    name: 'scipy',
    category: 'data',
    tier: 'popular',
    desc: '進階科學計算、最佳化、傅立葉轉換與統計檢定',
    runtimeHint: 'Termux 使用預編譯原生套件 python-scipy，避免在手機上從原始碼編譯 NumPy／SciPy',
    aliases: ['stats', 'fft', 'optimize'],
    pyodide: { supported: true, packageName: 'scipy' },
    termux: { mode: 'pkg', targetName: 'python-scipy' },
  },
  {
    id: 'scikit-learn',
    name: 'scikit-learn',
    category: 'data',
    tier: 'popular',
    desc: '機器學習分類、迴歸、聚類與特徵工程框架',
    runtimeHint: '目前沒有已驗證的官方 Termux ARM64／Python 3.14 預編譯版本；DroidPy 已停用手機端原始碼編譯，避免安裝失敗與長時間耗電',
    aliases: ['sklearn', 'ml', 'ai'],
    pyodide: { supported: true, packageName: 'scikit-learn' },
    termux: { mode: 'pip', targetName: 'scikit-learn' },
  },
  {
    id: 'sympy',
    name: 'sympy',
    category: 'data',
    tier: 'popular',
    desc: '符號微積分、方程式求解與數學推導引擎',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['math', 'calculus', 'algebra'],
    pyodide: { supported: true, packageName: 'sympy' },
    termux: { mode: 'pip', targetName: 'sympy' },
  },
  {
    id: 'openpyxl',
    name: 'openpyxl',
    category: 'data',
    tier: 'popular',
    desc: '純 Python 讀寫 .xlsx Excel 試算表與樣式',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['xlsx', 'excel', 'spreadsheet'],
    pyodide: { supported: true, packageName: 'openpyxl' },
    termux: { mode: 'pip', targetName: 'openpyxl' },
  },
  {
    id: 'polars',
    name: 'polars',
    category: 'data',
    tier: 'niche',
    desc: 'Rust 編寫的超高速多執行緒 DataFrame 分析引擎',
    runtimeHint: 'Termux 使用 TUR 預編譯 python-polars 與 Android Rust runtime，不再呼叫 pip/maturin/rustup；首次安裝會加入 TUR 第三方套件來源',
    aliases: ['df', 'rust', 'parquet'],
    pyodide: { supported: true, packageName: 'polars' },
    termux: { mode: 'pip', targetName: 'polars' },
  },
  {
    id: 'networkx',
    name: 'networkx',
    category: 'data',
    tier: 'niche',
    desc: '圖論演算法、社群網路關係拓撲與最短路徑分析',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['graph', 'network', 'dijkstra'],
    pyodide: { supported: true, packageName: 'networkx' },
    termux: { mode: 'pip', targetName: 'networkx' },
  },
  {
    id: 'tabulate',
    name: 'tabulate',
    category: 'data',
    tier: 'niche',
    desc: '將二維資料轉成漂亮的終端機 ASCII / Markdown 表格',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['table', 'markdown', 'pretty'],
    pyodide: { supported: true, packageName: 'tabulate' },
    termux: { mode: 'pip', targetName: 'tabulate' },
  },
  {
    id: 'mpmath',
    name: 'mpmath',
    category: 'data',
    tier: 'niche',
    desc: '任意精度浮點數學運算（可計算圓周率小數點後萬位）',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['pi', 'precision', 'decimal'],
    pyodide: { supported: true, packageName: 'mpmath' },
    termux: { mode: 'pip', targetName: 'mpmath' },
  },
  {
    id: 'jmespath',
    name: 'jmespath',
    category: 'data',
    tier: 'niche',
    desc: '以簡潔查詢語法萃取深層巢狀 JSON API 資料',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['json', 'query', 'jq'],
    pyodide: { supported: true, packageName: 'jmespath' },
    termux: { mode: 'pip', targetName: 'jmespath' },
  },

  // === 圖像與影音 (Media, Vision & Docs) ===
  {
    id: 'pillow',
    name: 'pillow',
    category: 'media',
    tier: 'popular',
    desc: '圖片裁切、縮圖、浮水印與濾鏡處理核心 (PIL)',
    runtimeHint: '沙盒 WASM / Termux 預編譯名為 python-pillow',
    aliases: ['pil', 'python-pillow', 'image', 'photo'],
    pyodide: { supported: true, packageName: 'pillow' },
    termux: { mode: 'pkg', targetName: 'python-pillow' },
  },
  {
    id: 'yt-dlp',
    name: 'yt-dlp',
    category: 'media',
    tier: 'popular',
    desc: '跨平台影音串流解析與下載神器（建議搭 ffmpeg）',
    runtimeHint: 'Termux pip 原生下載體驗最佳',
    aliases: ['youtube', 'yt', 'video', 'dl'],
    pyodide: { supported: true, packageName: 'yt-dlp' },
    termux: { mode: 'pip', targetName: 'yt-dlp' },
  },
  {
    id: 'ffmpeg',
    name: 'ffmpeg',
    category: 'media',
    tier: 'popular',
    desc: '原生 C/C++ 音訊與視訊轉碼剪輯命令列工具',
    runtimeHint: 'Termux 系統級 pkg 二進位工具',
    aliases: ['mp4', 'mp3', 'video', 'audio', 'transcode'],
    pyodide: { supported: false },
    termux: { mode: 'pkg', targetName: 'ffmpeg' },
  },
  {
    id: 'qrcode',
    name: 'qrcode',
    category: 'media',
    tier: 'popular',
    desc: '快速產生純文字或圖片版 QR Code 二維條碼',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['qr', 'barcode', 'scan'],
    pyodide: { supported: true, packageName: 'qrcode' },
    termux: { mode: 'pip', targetName: 'qrcode' },
  },
  {
    id: 'pypdf',
    name: 'pypdf',
    category: 'media',
    tier: 'popular',
    desc: '純 Python 合併、拆分、加密與擷取 PDF 文字',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['pdf', 'pypdf2', 'merge'],
    pyodide: { supported: true, packageName: 'pypdf' },
    termux: { mode: 'pip', targetName: 'pypdf' },
  },
  {
    id: 'mutagen',
    name: 'mutagen',
    category: 'media',
    tier: 'niche',
    desc: '讀取與編輯 MP3 / FLAC / M4A 音樂 ID3 標籤與專輯封面',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['mp3', 'id3', 'flac', 'audio'],
    pyodide: { supported: true, packageName: 'mutagen' },
    termux: { mode: 'pip', targetName: 'mutagen' },
  },
  {
    id: 'python-barcode',
    name: 'python-barcode',
    category: 'media',
    tier: 'niche',
    desc: '產生 Code128、EAN-13 等 SVG / PNG 商品條碼',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['ean13', 'code128', 'svg'],
    pyodide: { supported: true, packageName: 'python-barcode' },
    termux: { mode: 'pip', targetName: 'python-barcode' },
  },
  {
    id: 'ascii-magic',
    name: 'ascii-magic',
    category: 'media',
    tier: 'niche',
    desc: '將照片或字元轉為彩色的終端機 ANSI ASCII Art',
    runtimeHint: '需先安裝 Pillow（Termux 請先裝 python-pillow）',
    aliases: ['ascii', 'art', 'ansi'],
    pyodide: { supported: true, packageName: 'ascii-magic' },
    termux: { mode: 'pip', targetName: 'ascii-magic' },
  },
  {
    id: 'markdown',
    name: 'markdown',
    category: 'media',
    tier: 'niche',
    desc: '把 Markdown 文件快速渲染轉換為乾淨 HTML',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['md', 'html', 'docs'],
    pyodide: { supported: true, packageName: 'markdown' },
    termux: { mode: 'pip', targetName: 'markdown' },
  },

  // === Web 與 API (Web & Backend) ===
  {
    id: 'flask',
    name: 'flask',
    category: 'web',
    tier: 'popular',
    desc: '輕巧易上手的 Python Web 與本機 REST API 伺服器',
    runtimeHint: '純 Python / Termux 原生可開啟真實埠號服務',
    aliases: ['web', 'api', 'server', 'http'],
    pyodide: { supported: true, packageName: 'flask' },
    termux: { mode: 'pip', targetName: 'flask' },
  },
  {
    id: 'jinja2',
    name: 'jinja2',
    category: 'web',
    tier: 'popular',
    desc: '現代化 HTML / 設定檔 / 程式碼模板引擎',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['template', 'html'],
    pyodide: { supported: true, packageName: 'jinja2' },
    termux: { mode: 'pip', targetName: 'jinja2' },
  },
  {
    id: 'bottle',
    name: 'bottle',
    category: 'web',
    tier: 'niche',
    desc: '零外部相依、單檔微架構 Python WSGI Web 框架',
    runtimeHint: '純 Python / 手機秒裝啟動',
    aliases: ['micro', 'wsgi', 'server'],
    pyodide: { supported: true, packageName: 'bottle' },
    termux: { mode: 'pip', targetName: 'bottle' },
  },
  {
    id: 'websockets',
    name: 'websockets',
    category: 'web',
    tier: 'niche',
    desc: '標準 asyncio 即時雙向 WebSocket 通訊庫',
    runtimeHint: '純 Python（部分加速擴充會自動跳過）',
    aliases: ['ws', 'realtime', 'socket'],
    pyodide: { supported: true, packageName: 'websockets' },
    termux: { mode: 'pip', targetName: 'websockets' },
  },
  {
    id: 'starlette',
    name: 'starlette',
    category: 'web',
    tier: 'niche',
    desc: 'FastAPI 底層的高效能純 Python ASGI 非同步框架',
    runtimeHint: '純 Python（無須 Rust 編譯即可於手機執行）',
    aliases: ['asgi', 'async', 'fastapi'],
    pyodide: { supported: true, packageName: 'starlette' },
    termux: { mode: 'pip', targetName: 'starlette' },
  },
  {
    id: 'pyjwt',
    name: 'pyjwt',
    category: 'web',
    tier: 'niche',
    desc: '簽發與驗證 JSON Web Token (JWT) API 授權憑證',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['jwt', 'auth', 'token'],
    pyodide: { supported: true, packageName: 'pyjwt' },
    termux: { mode: 'pip', targetName: 'pyjwt' },
  },

  // === 冷門寶藏工具 (Niche Gems & CLI) ===
  {
    id: 'rich',
    name: 'rich',
    category: 'niche',
    tier: 'popular',
    desc: '終端機彩色排版、進度條、語法高亮與樹狀結構神器',
    runtimeHint: '純 Python / Termux 終端視覺效果極佳',
    aliases: ['color', 'tui', 'table', 'progress'],
    pyodide: { supported: true, packageName: 'rich' },
    termux: { mode: 'pip', targetName: 'rich' },
  },
  {
    id: 'tqdm',
    name: 'tqdm',
    category: 'niche',
    tier: 'popular',
    desc: '一行程式碼為任何迴圈或下載加上即時進度條',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['progress', 'bar'],
    pyodide: { supported: true, packageName: 'tqdm' },
    termux: { mode: 'pip', targetName: 'tqdm' },
  },
  {
    id: 'faker',
    name: 'faker',
    category: 'niche',
    tier: 'niche',
    desc: '自動產生測試用姓名、地址、電話與假資料集（支援繁中）',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['mock', 'dummy', 'testdata'],
    pyodide: { supported: true, packageName: 'faker' },
    termux: { mode: 'pip', targetName: 'faker' },
  },
  {
    id: 'thefuzz',
    name: 'thefuzz',
    category: 'niche',
    tier: 'niche',
    desc: '字串模糊比對與拼字相似度計算（原 fuzzywuzzy）',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['fuzzy', 'fuzzywuzzy', 'match'],
    pyodide: { supported: true, packageName: 'thefuzz' },
    termux: { mode: 'pip', targetName: 'thefuzz' },
  },
  {
    id: 'pyfiglet',
    name: 'pyfiglet',
    category: 'niche',
    tier: 'niche',
    desc: '將英數文字轉成數十種復古大字體 ASCII Banner',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['figlet', 'banner', 'ascii'],
    pyodide: { supported: true, packageName: 'pyfiglet' },
    termux: { mode: 'pip', targetName: 'pyfiglet' },
  },
  {
    id: 'colorama',
    name: 'colorama',
    category: 'niche',
    tier: 'niche',
    desc: '跨平台終端機 ANSI 文字前景／背景色彩工具',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['ansi', 'color', 'terminal'],
    pyodide: { supported: true, packageName: 'colorama' },
    termux: { mode: 'pip', targetName: 'colorama' },
  },
  {
    id: 'arrow',
    name: 'arrow',
    category: 'niche',
    tier: 'niche',
    desc: '比內建 datetime 更直覺人性化的時區與日期換算庫',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['datetime', 'time', 'timezone'],
    pyodide: { supported: true, packageName: 'arrow' },
    termux: { mode: 'pip', targetName: 'arrow' },
  },
  {
    id: 'pendulum',
    name: 'pendulum',
    category: 'niche',
    tier: 'niche',
    desc: '強大易用的日曆週期、相對時間與多語系時間格式庫',
    runtimeHint: '純 Python / 沙盒與 Termux 可用',
    aliases: ['date', 'time', 'tz'],
    pyodide: { supported: true, packageName: 'pendulum' },
    termux: { mode: 'pip', targetName: 'pendulum' },
  },
  {
    id: 'humanize',
    name: 'humanize',
    category: 'niche',
    tier: 'niche',
    desc: '將位元組大小、秒數與數字轉為人類易讀文字（如 2 hours ago）',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['format', 'bytes', 'readable'],
    pyodide: { supported: true, packageName: 'humanize' },
    termux: { mode: 'pip', targetName: 'humanize' },
  },
  {
    id: 'schedule',
    name: 'schedule',
    category: 'niche',
    tier: 'niche',
    desc: '極簡人類語法排程器（every().hour.do(job)）',
    runtimeHint: '純 Python / Termux 常駐排程好幫手',
    aliases: ['cron', 'timer', 'job'],
    pyodide: { supported: true, packageName: 'schedule' },
    termux: { mode: 'pip', targetName: 'schedule' },
  },
  {
    id: 'loguru',
    name: 'loguru',
    category: 'niche',
    tier: 'niche',
    desc: '開箱即用的彩色日誌系統（支援自動切割與例外追蹤）',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['log', 'logger', 'debug'],
    pyodide: { supported: true, packageName: 'loguru' },
    termux: { mode: 'pip', targetName: 'loguru' },
  },
  {
    id: 'icecream',
    name: 'icecream',
    category: 'niche',
    tier: 'niche',
    desc: '比 print() 更好的除錯利器 ic(x)，自動印出變數名稱與行號',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['ic', 'debug', 'print'],
    pyodide: { supported: true, packageName: 'icecream' },
    termux: { mode: 'pip', targetName: 'icecream' },
  },
  {
    id: 'symspellpy',
    name: 'symspellpy',
    category: 'niche',
    tier: 'niche',
    desc: '極速編輯距離拼字檢查與自動糾錯演算法庫',
    runtimeHint: '純 Python / 沙盒與 Termux 皆可用',
    aliases: ['spellcheck', 'typo', 'editdistance'],
    pyodide: { supported: true, packageName: 'symspellpy' },
    termux: { mode: 'pip', targetName: 'symspellpy' },
  },
  {
    id: 'pinyin',
    name: 'pypinyin',
    category: 'niche',
    tier: 'niche',
    desc: '將中文漢字轉換為聲調拼音、首字母縮寫或注音風格',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['zh', 'chinese', 'hanzi', 'pypinyin'],
    pyodide: { supported: true, packageName: 'pypinyin' },
    termux: { mode: 'pip', targetName: 'pypinyin' },
  },
  {
    id: 'jieba',
    name: 'jieba',
    category: 'niche',
    tier: 'niche',
    desc: '經典中文自然語言斷詞與關鍵字萃取工具（結巴分詞）',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['nlp', 'segment', 'chinese'],
    pyodide: { supported: true, packageName: 'jieba' },
    termux: { mode: 'pip', targetName: 'jieba' },
  },
  {
    id: 'art',
    name: 'art',
    category: 'niche',
    tier: 'niche',
    desc: '內含數百款文字藝術字體與趣味 ASCII 表情符號庫',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['ascii', 'emoji', 'text2art'],
    pyodide: { supported: true, packageName: 'art' },
    termux: { mode: 'pip', targetName: 'art' },
  },

  // === 編譯與系統工具 (System, Crypto & Config) ===
  {
    id: 'cryptography',
    name: 'cryptography',
    category: 'system',
    tier: 'popular',
    desc: 'AES / RSA 加解密、數位簽章與 TLS 憑證處理',
    runtimeHint: '沙盒 WASM / Termux 預編譯名為 python-cryptography',
    aliases: ['aes', 'rsa', 'crypto', 'python-cryptography'],
    pyodide: { supported: true, packageName: 'cryptography' },
    termux: { mode: 'pkg', targetName: 'python-cryptography' },
  },
  {
    id: 'pyyaml',
    name: 'pyyaml',
    category: 'system',
    tier: 'popular',
    desc: '讀寫 YAML 設定檔與 CI/CD Workflow 描述檔',
    runtimeHint: '沙盒 WASM / Termux 皆可用',
    aliases: ['yaml', 'yml', 'config'],
    pyodide: { supported: true, packageName: 'pyyaml' },
    termux: { mode: 'pip', targetName: 'pyyaml' },
  },
  {
    id: 'python-dotenv',
    name: 'python-dotenv',
    category: 'system',
    tier: 'popular',
    desc: '自動從 .env 檔案載入專案環境變數',
    runtimeHint: '純 Python / Termux & 沙盒皆可用',
    aliases: ['env', 'dotenv', 'secret'],
    pyodide: { supported: true, packageName: 'python-dotenv' },
    termux: { mode: 'pip', targetName: 'python-dotenv' },
  },
  {
    id: 'clang',
    name: 'clang',
    category: 'system',
    tier: 'popular',
    desc: 'Android 原生 C / C++ 編譯器（編譯原生擴充必備）',
    runtimeHint: 'Termux pkg 原生套件',
    aliases: ['gcc', 'c++', 'compiler', 'cc'],
    pyodide: { supported: false },
    termux: { mode: 'pkg', targetName: 'clang' },
  },
  {
    id: 'cmake',
    name: 'cmake',
    category: 'system',
    tier: 'popular',
    desc: '跨平台 C/C++ 專案與高階科學庫建置系統',
    runtimeHint: 'Termux pkg 原生套件',
    aliases: ['make', 'build', 'ninja'],
    pyodide: { supported: false },
    termux: { mode: 'pkg', targetName: 'cmake' },
  },
  {
    id: 'git',
    name: 'git',
    category: 'system',
    tier: 'popular',
    desc: '在手機工作區複製 GitHub 倉庫與管理程式碼版本',
    runtimeHint: 'Termux pkg 原生套件',
    aliases: ['github', 'clone', 'vcs'],
    pyodide: { supported: false },
    termux: { mode: 'pkg', targetName: 'git' },
  },
  {
    id: 'sqlite3-cli',
    name: 'sqlite',
    category: 'system',
    tier: 'niche',
    desc: '輕量級 SQLite 命令列資料庫管理工具',
    runtimeHint: 'Termux pkg 原生套件（Python 已內建 sqlite3）',
    aliases: ['sql', 'db', 'database'],
    pyodide: { supported: false },
    termux: { mode: 'pkg', targetName: 'sqlite' },
  },
  {
    id: 'jq',
    name: 'jq',
    category: 'system',
    tier: 'niche',
    desc: '極速命令列 JSON 篩選與格式化工具',
    runtimeHint: 'Termux pkg 原生套件',
    aliases: ['json', 'cli', 'shell'],
    pyodide: { supported: false },
    termux: { mode: 'pkg', targetName: 'jq' },
  },
];

export interface FuzzyMatchResult {
  item: CatalogPackageItem;
  score: number;
  matchedAlias?: string;
}

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function editDistanceLimited(a: string, b: string, maxDist = 2): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    let rowMin = dp[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
      if (dp[j] < rowMin) rowMin = dp[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
  }
  return dp[b.length];
}

function isSubsequence(needle: string, haystack: string): number {
  let ni = 0;
  let gaps = 0;
  let lastIdx = -1;
  for (let hi = 0; hi < haystack.length && ni < needle.length; hi++) {
    if (haystack[hi] === needle[ni]) {
      if (lastIdx !== -1) gaps += hi - lastIdx - 1;
      lastIdx = hi;
      ni++;
    }
  }
  return ni === needle.length ? gaps : -1;
}

export function fuzzyMatchPackages(
  query: string,
  items: CatalogPackageItem[] = PACKAGE_CATALOG,
  options?: {
    runtime?: 'all' | 'pyodide' | 'termux-pip' | 'termux-pkg';
    limit?: number;
  }
): FuzzyMatchResult[] {
  const raw = query.trim().toLowerCase();
  if (!raw) return [];
  const normQ = normalizeToken(raw);
  const runtime = options?.runtime ?? 'all';
  const limit = options?.limit ?? 8;

  const filtered = items.filter((item) => {
    if (runtime === 'pyodide') return Boolean(item.pyodide?.supported);
    if (runtime === 'termux-pip') return item.termux?.mode === 'pip';
    if (runtime === 'termux-pkg') return item.termux?.mode === 'pkg';
    return true;
  });

  const scored: FuzzyMatchResult[] = [];

  for (const item of filtered) {
    const targetName =
      runtime === 'pyodide'
        ? (item.pyodide?.packageName ?? item.name)
        : runtime === 'termux-pip' || runtime === 'termux-pkg'
        ? (item.termux?.targetName ?? item.name)
        : item.name;

    const lowerName = targetName.toLowerCase();
    const normName = normalizeToken(lowerName);
    const aliases = item.aliases.map((a) => a.toLowerCase());
    let score = 0;
    let matchedAlias: string | undefined;

    if (lowerName === raw || normName === normQ) {
      score = 1000;
    } else if (aliases.some((a) => a === raw || normalizeToken(a) === normQ)) {
      matchedAlias = aliases.find((a) => a === raw || normalizeToken(a) === normQ);
      score = 920;
    } else if (lowerName.startsWith(raw) || (normQ && normName.startsWith(normQ))) {
      score = 840 - Math.min(80, Math.abs(normName.length - normQ.length) * 4);
    } else if (aliases.some((a) => a.startsWith(raw))) {
      matchedAlias = aliases.find((a) => a.startsWith(raw));
      score = 780;
    } else if (lowerName.includes(raw) || (normQ.length >= 2 && normName.includes(normQ))) {
      score = 700 - Math.min(60, lowerName.indexOf(raw) * 5);
    } else if (aliases.some((a) => a.includes(raw))) {
      matchedAlias = aliases.find((a) => a.includes(raw));
      score = 620;
    } else if (item.desc.toLowerCase().includes(raw)) {
      score = 520;
    } else if (normQ.length >= 2) {
      const subGaps = isSubsequence(normQ, normName);
      if (subGaps >= 0) {
        score = 460 - Math.min(180, subGaps * 18);
      } else {
        const dist = editDistanceLimited(normQ, normName, normQ.length >= 5 ? 2 : 1);
        if (dist <= 2) {
          score = 380 - dist * 70;
        }
      }
    }

    if (score > 0) {
      if (item.tier === 'popular') score += 15;
      scored.push({ item, score, matchedAlias });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
