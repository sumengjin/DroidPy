# Changelog / 更新日誌

All notable changes to **DroidPy** are documented in this file.

## [Unreleased]
- **符號列左右滑動選擇並輸入**：手指從符號按鈕按下後可左右滑過其他符號，放開時插入最後選中的符號；單擊仍可直接插入，滑動起點不會提前誤輸入。
- **編輯符號列寬度跟隨編輯區**：移除固定三分之二寬度，改為完整填滿編輯區容器，並移除符號列內的垂直裝飾分隔線。
- **Termux 式整體終端點擊輸入**：輸出區與底部命令列共用同一個全寬終端表面；點擊終端內容任意非操作按鈕位置即聚焦共用輸入框並喚起 Android 輸入法。輸入框執行期間仍可聚焦，是否允許送出則依互動輸入狀態判斷。
- **終端輸出／輸入共用單一外框**：輸出捲動區與輸入列共享同一個終端表面及外框，移除輸入列獨立卡片感與送出按鈕底色；輸入列仍維持終端寬度三分之二。
- **Android 編輯符號列扁平化**：移除符號列頂部分隔框、按鈕外框與按鈕底色，整條符號列縮窄至編輯區寬度三分之二並置中。
- **終端輸出與輸入真正合併**：輸出捲動區與唯一輸入列現在共置於同一個終端表面容器內，輸入列不再作為獨立底部卡片呈現；保留整體輸入列三分之二寬度、共用輸入狀態、命令歷史與 Python／Termux stdin 路由。
- **執行控制改為純文字無框樣式**：手機與平板頂欄的執行／停止／暫停控制移除彩色按鈕底、圓角膠囊和外框，只保留圖示與文字狀態，避免 Android WebView 原生按鈕外觀殘留。
- **共用終端輸入列與執行控制修正**：終端改為唯一且持續顯示的輸入框，依執行狀態將文字送往 Python `input()`、Termux 執行中程序的 stdin，或閒置時的 Python REPL／Termux Shell；保留命令歷史、方向鍵回查、Android Enter 提交與可見送出按鈕，輸出區獨立捲動且不因輸入而清空。輸入列連同標籤及按鈕整體維持終端寬度三分之二。
- **執行按鈕與狀態列避讓**：移除執行按鈕的裝飾性外框，頂欄高度依 Android 狀態列安全區動態增加，避免按鈕碰到電量與網路訊號圖示。
- **編輯區透明度統一**：3D 背景啟用時，CodeMirror 編輯畫布改為透明，直接使用與終端相同的工作紙玻璃底層，不再疊加第二層高不透明色塊。
- **全螢幕玻璃白紙層**：手機頂部／底部與平板頂部共用覆蓋整個視窗的薄透白紙層；3D 寫實場景留在紙下並透出，所有工作區文字與控制統一位於紙面上。中間內容不再另外繪製第二張底紙。
- **恢復平板玻璃分隔線**：編輯器與終端之間恢復半透明、帶柔和光暈的可拖曳分隔握把，保留原有觸控／滑鼠及鍵盤調整。
- **手機工作區改為單張連續工作紙**：頂部狀態區與底部導覽保持透明，中間主工作區使用不透明主題底色；編輯器、終端與檔案區不再各自鋪設半透明背景，避免多層白底互相遮蓋內容。設定改為完全不透明的獨立浮層。平板可拖曳編輯器／終端分隔線的操作維持不變。
- **修正手機／平板設定與工作區操作層級**：設定工作區改用不透明主題底色並提升浮層層級，避免底層頁面透出；平板設定入口移至「分割／專注編輯」控制右側；頂欄執行控制提高層級並補上完整可見邊框；手機工作區切換統一經過明確目的地回呼，新增對應回歸檢查。
- **平板頂部導覽合併為單一列**：將編輯器、終端、檔案與爬蟲瀏覽器入口整合進同一個頂部工作區列，移除獨立重複的第二排導覽；檔案分頁移入編輯器窗格，執行、分割視圖與設定入口保留，避免全域頂部控制重複佔位。
- **手機工作區重構**：修正底部導覽巢狀 Grid 導致四個入口被壓縮在左側四分之一欄位的布局缺陷；手機導覽改為全寬四等分觸控區，主工作區固定單欄全寬，頂部顯示目前檔名或工作區名稱。平板工作區維持獨立導覽與可調整分割；爬蟲瀏覽器功能與會話資料不變。
- **平板工作區改為可調式工作臺**：取消編輯器／輸出面板固定比例，加入可拖曳分隔器；支援觸控、滑鼠與方向鍵調整，並提供可存取的分隔器狀態。手機仍維持單一任務畫面，爬蟲瀏覽器功能未更動。
- **讓編輯器操作一眼看懂**：格式化圖示改為「整理空白」（實際清理行尾空白、縮排 Tab 與多餘空行；JSON 另做縮排排版，不再誤稱完整程式碼格式化）；放大鏡改為明示「搜尋／取代」；鍵盤圖示改為「符號鍵列」，並以 `aria-pressed` 表示顯示狀態。手機與平板工具列都顯示文字標籤，避免只靠猜圖示操作。
- **移除平板重複工作區導覽並凍結爬蟲瀏覽器範圍**：平板只保留一個全域目的地切換列，刪除輔助窗格內重複的終端／檔案／瀏覽器選擇列，將高度還給實際內容；新增完整重構驗收規格，明確要求淘汰 AI Studio 舊資訊架構，並保護爬蟲瀏覽器的 Cookie／Session／WebView 行為不受本輪改動影響。
- **重建手機／平板工作區骨架**：平板由固定側欄改為橫向工作區切換列，主工作區獲得完整寬度；分割窗格改用彈性權重而非固定 56% 比例；手機移除重複的頁面標題／檔名，頂部僅保留必要操作；同步修正選取狀態回歸測試與工作區設計規範，明確禁止沿用 AI Studio 舊布局。
- **精簡手機／平板工作區視覺層級**：移除導航選中框、品牌圖徽與多餘分隔線；選中狀態改以文字顏色呈現；壓縮終端狀態／日誌／複製／清除工具列及平板窗格工具列高度，將可用空間還給編輯器與輸出內容。
- **拆分 Termux 原生套件管理工作區**：將 Termux APT／pip 套件搜尋、名稱提示、分類篩選、安裝／移除操作與套件升級入口移至獨立元件；保留連線健康資訊中的已安裝套件操作與共用 Termux 執行狀態，降低套件管理與連線／Shell 面板之間的耦合。
- **扁平化沙盒套件目錄互動**：套件分類與熱門／進階篩選改用透明未選取、僅選取項目顯示主題外框的共用導覽樣式；套件項目改為分隔式工作列，移除重複卡片框線，並補齊篩選的 aria-pressed 狀態。
- **拆分 Pyodide 套件管理工作區**：將沙盒套件搜尋、模糊比對、分類篩選、安裝／移除狀態、升級清單及已安裝套件介面移至獨立元件；設定中心僅負責工作區組合與資料傳遞，降低巨型元件的狀態耦合。
- **補齊設定開關無障礙與主題對比驗證**：五個開關加入在地化無障礙名稱，滑塊表面改由主題 token 控制；CI 對全部 14 套主題的主要文字、次要文字及強調文字執行 WCAG AA 4.5:1 對比檢查。
- **統一設定開關的主題感知樣式**：五個系統／套件／編輯器開關改用共用 `dp-switch`，移除固定灰色軌道與固定白色滑塊依賴；未選取、啟用、禁用及鍵盤焦點均依目前主題 token 呈現。
- **清理工作區測試與主畫面匯入**：回歸測試統一使用 Settings Workspace 命名，並讓 Material token 檢查真正匹配 CSS 變數定義；移除主畫面不再使用的圖示匯入。
- **建立工作區設計規範文件**：記錄手機／平板資訊架構、透明導覽選取規則、主題 token、浮層邊界及共用執行控制器責任，作為後續全面重建的介面基準。
- **移除未使用的 Material 主題變數**：清除所有舊 `--md-*` 色彩與 FAB token，主題表面、選取、焦點與禁用狀態完全改由 DroidPy 自有的 `--ide-*` 與 `dp-*` 設計系統控制。
- **統一設定工作區命名**：將主畫面與型別中的舊抽屜／負頁命名改為 Settings Workspace，讓程式結構與新的獨立全螢幕設定中心一致；同步移除主畫面最後一處 Material 表面背景。
- **統一平板分割檢視圖示**：使用一致的向量圖示呈現「分割檢視／專注編輯器」狀態，避免以字元符號充當主要操作圖示。
- **修正共用頂欄回歸檢查定位**：測試改為分別檢查頂欄元件與手機底部導覽，不再依賴已抽離的舊主畫面標記。
- **補齊共用頂欄手機版必要回呼**：手機版頂欄沿用統一 Header 元件時，保留檔案選取與新增檔案操作介面，避免手機版與平板版共用元件時產生不完整屬性。
- **抽離手機／平板共用工作區頂欄**：檔案標籤、分割檢視、設定入口與 Run／Pause／Stop 控制集中於獨立頂欄元件，保留兩種裝置各自的排版與觸控尺寸。
- **全面淘汰舊式 Material 卡片與浮層樣式**：工具、Termux、檔案、瀏覽器、儲存及系統對話框改用透明無框內容區；必要提示改成細側線，浮層改為輕量主題表面，不再依賴舊卡片陰影與大圓角。
- **統一檔案分頁與窗格切換狀態**：檔案分頁、平板次工作區標籤及分割檢視開關共用主題感知的選取狀態；新增透明圖示操作樣式，並補齊 aria-selected／aria-pressed 狀態，同時保留平板分割檢視入口。
- **修正共用執行控制器的測試定位**：回歸檢查分別定位手機與平板的控制器實例，避免把工作區導覽元件誤判成執行控制器。
- **更新執行列安全回歸檢查**：測試改為驗證手機和平板都連接至共用執行控制器，並覆蓋暫停／繼續狀態與 Run／Stop 控制入口。
- **抽離共用執行控制器並簡化主工作區外框**：手機與平板共用同一套 Run／Pause／Resume／Stop 狀態控制，保留各自觸控尺寸與文案；主工具列、編輯器與輔助窗格改為透明背景與輕量分隔，減少舊式表面容器。
- **同步設計系統回歸斷言**：設定分類測試改為驗證共用 `dp-nav-item` 互動元件，並由主題 token 檢查選取外框、閒置狀態與禁用狀態。
- **建立 DroidPy 原生互動設計語言**：新增主題感知的透明導覽、選取外框、禁用狀態、鍵盤焦點與無卡片工作列樣式，手機／平板導覽、設定分類及工具清單共用同一套設計 token。
- **更新工具中心回歸測試**：檢查直接進入套件與系統工作項目，並確保已淘汰的資料夾中轉頁與對應返回狀態不再回歸。
- **扁平化設定與工具資訊架構**：Termux、套件、Android 儲存及個人化分類直接列出可用工作項目，移除中間資料夾頁；套件管理可直接進入 Termux 原生套件或 Pyodide 沙盒。工具列改為無卡片底色的分隔式清單，降低多層容器與重複返回操作。
- **同步更新介面架構回歸檢查**：測試改為驗證共用手機／平板導覽與全螢幕設定工作區，避免繼續依賴已移除的舊抽屜及膠囊導覽實作。
- **設定中心脫離抽屜式呈現**：設定、Termux、套件與 Android 管理改由獨立全螢幕工作區承載；手機保留分類／內容逐層返回，平板維持常駐分類導覽。分類項目改用透明閒置狀態與選取外框，不再堆疊卡片容器。
- **重建跨裝置工作區導覽基礎**：手機底部導覽與平板側邊導覽改由同一個導覽元件及目的地模型驅動；兩種版型各自適配螢幕，不再複製兩套狀態邏輯。導覽項目採透明閒置狀態、主題強調色選取外框及明確的文字／圖示層級，移除手機導覽的 Material 膠囊選取底色。
- **工作區按鈕與窗格視覺減法**：移除平板輔助窗格切換列外層的底色與邊框容器；手機／平板檔案標籤、平板側欄與窗格切換按鈕統一採透明未選取狀態，僅目前選取項目顯示強調外框，保留清楚的圖示與文字狀態。
- **手機與平板共用檔案標籤導覽**：抽出 `WorkspaceFileTabs`，統一兩種版型的檔案切換、選取狀態、無障礙標籤與新增檔案入口；手機保留較大的觸控標籤，平板採用緊湊工作區標籤，兩端共用同一組檔案操作回呼。
- **手機編輯器檔案列改版**：以可橫向捲動的檔案標籤取代下拉選單，新增檔案入口獨立呈現，格式化、搜尋與符號列收納至第二層緊湊工具列；保留原有檔案切換及編輯操作。
- **平板工作區側欄重設**：將 DroidPy 品牌識別、編輯器／終端／檔案／瀏覽器入口與設定入口整合至加寬側欄，移除頂欄重複的設定與品牌區，讓頂欄回歸檔案及執行操作。
- **共用手機與平板編輯器工作區**：抽出 `CodeEditorSurface`，統一程式碼編輯器、游標回報、執行快捷鍵與 Android 符號列；兩種裝置版型只保留各自的工具列與排版，不再重複維護編輯核心。
- **抽離平板工作區狀態管理**：將平板目前工作區、分割檢視、快速導向輸出窗格與切換分割模式集中至 `useTabletWorkspace`；側邊導覽、分割切換及教學中的瀏覽器導向統一經過同一控制器，避免不同入口各自修改分散狀態。
- **抽離平板工作區狀態管理**：將平板目前工作區、分割檢視、快速導向輸出窗格與切換分割模式集中至 `useTabletWorkspace`，主畫面不再直接持有這組彼此耦合的狀態更新流程。
- **抽離共用工作區導覽元件**：將平板側邊導覽從主畫面移至獨立元件，集中管理編輯器、終端、檔案與瀏覽器入口及選取狀態，為手機與平板共用同一套工作區導覽邏輯建立基礎。
- **修正平板工作區切換邏輯**：側邊導覽選取終端、檔案或瀏覽器時，直接以該工作區作為主要畫面；需要同時操作時再切換分割檢視。分割模式收合後回到編輯器，避免輔助面板永遠只能當作編輯器旁的小窗格。
- **修正平板設定中心返回行為**：平板選取分類後仍將分類側欄視為常駐導覽，Android 返回鍵不再先執行一次看不見的「返回分類」狀態切換；手機仍保留分類頁與內容頁的逐層返回。
- **平板工作區導覽改版**：新增固定側邊導覽，可直接切換編輯器、終端、檔案與瀏覽器；選擇輔助工作區時自動開啟分割檢視，回到編輯器則收合分割窗格。
- **修正設定中心分類導覽排列**：分類側欄改為垂直堆疊標題與分類清單，避免原本 `flex` 預設橫向排列，讓手機分類首頁與平板左側導覽都出現標題、分類卡片並排擠壓的問題。
- **工具中心分類卡片重整**：手機維持單欄清晰列表，平板與寬螢幕改用雙欄卡片，增加點擊面積、分類層次與滑入回饋，減少原本密集的分隔列表感。
- **寬螢幕設定／工具中心改為雙欄工作區**：平板與桌面尺寸下，分類導覽固定留在左側，右側直接呈現所選功能；分類選取狀態清楚標示，不再需要在分類首頁與功能頁之間反覆切換。手機仍保留單頁進入與返回分類的流程，避免窄螢幕擠壓內容。

### Changed — 響應式設定與工具工作區基礎
- 寬螢幕上的設定／工具中心改為置中的大型工作面板，保留手機全螢幕操作方式，避免平板與桌面寬度下內容無限制拉伸。
- 統一設定中心的遮罩層與面板邊界，改善大螢幕上的視覺層級；此為後續雙欄資訊架構改造的第一步。

### Fixed — Android 返回鍵與工作區導航
- 手機底部工作區切換會保留最近瀏覽路徑；Android 返回鍵先逐一返回先前工作區，沒有歷史時回到編輯器，不再從終端機、檔案或瀏覽器頁面直接觸發退出。
- 只有停留在編輯器主頁且沒有待關閉的對話框、設定子頁或瀏覽器頁面時，才會顯示「再按一次返回鍵退出」提示。
- 在設定分類、彈窗、內嵌瀏覽器或 WebView 歷史中消耗的返回操作，會重置雙擊退出計時，避免返回上一層後再按一次就意外退出。
- 新增 CI 回歸檢查，覆蓋工作區返回堆疊及原生雙擊退出計時器。

### Fixed — TUR 套件庫初始化順序與備份還原
- 還原 Polars 前先更新官方 Termux 套件索引，再安裝 tur-repo 並更新索引，修正全新或索引過期環境找不到 tur-repo 的問題。
- 將 TUR 專屬的 python-polars 與一般 Termux 套件分開安裝；即使 TUR 無法連線或 Polars 安裝失敗，也不會中止其他套件的還原。
- 統一健康檢查與備份還原的 Python 判定方式，支援可執行的 python、python3 及版本化直譯器；若 Python 不可用，只跳過 pip 還原，不阻斷原生套件還原。
- 加入回歸檢查，確保 TUR 初始化失敗不會阻斷其他套件還原。

### Improved — 日誌分類與名稱
- 將日誌入口明確命名為「日誌中心」，並將三個分類標示為「Python 執行日誌」、「DroidPy App 日誌」及「Android／Termux 日誌」。
- 依目前選取的分類顯示簡短說明；保留「全部日誌／錯誤日誌」篩選，方便使用者判斷要匯出哪一類紀錄。

### Fixed — Termux 串流退出碼誤判
- 修正 NDJSON 串流解析器：以真正的換行字元切分事件，不再把反斜線加 n 當作分隔符。
- 避免原生程序已回報 exitCode=0，但前端因未辨識 done 事件而錯誤回報 exitCode=1。

### Fixed — 每次啟動重置診斷日誌
- 每次 DroidPy 啟動時清空上一輪應用程式日誌與 Android 原生日誌；不再從 localStorage 還原舊的應用日誌。
- 重置範圍僅限診斷日誌，不觸碰使用者程式檔案、設定、Termux 環境、套件及備份。
- 強制停止、正常關閉後再次啟動，以及覆蓋升級後首次啟動均建立全新日誌工作階段；重新安裝則由 Android 應用資料重建自然清空。

- **追蹤外部 Python 腳本內容來源**：裝置儲存讀取、執行前回寫與工作區 staging 現在都記錄檔案大小、SHA-256 與首個非空白位元組（不記錄程式碼內容），可比對原始檔、編輯器回寫及執行副本，定位 `IndentationError` 前多出的字元從哪一步開始出現。
- **修正設定中的 Android 外部腳本開啟路徑遺失**：從設定的裝置儲存頁開啟 `.py` 檔時，原本雖讀取了共享儲存路徑，卻在傳入編輯器前丟失路徑資訊，導致執行前無法寫回原檔。現在會保留並以原始路徑識別檔案，避免同名不同路徑的腳本互相覆蓋，並加入 CI 回歸檢查。
- **防止 Termux 並行操作破壞工作區腳本**：原生 Bridge 會先取得唯一執行保留權，再寫入待執行檔案；若已有套件安裝、還原或腳本程序執行，新的串流操作會被拒絕，不再先覆寫工作區檔案。腳本改以同目錄暫存檔、同步落盤與原子替換，並在替換後讀回驗證實際位元組，再記錄檔案大小、SHA-256 與首個非空白位元組，協助區分編輯器送入內容與磁碟落盤內容；新增對應 CI 回歸檢查。此修正針對已發現的競態風險，尚不能單憑日誌證明它就是本次多出 `.#` 字元的唯一成因。
- **避免同名外部腳本被舊工作區副本覆蓋**：Termux 執行請求會按工作區檔名去重，並將目前選取的編輯器內容最後寫入，避免同名舊檔因陣列順序覆蓋正在執行的腳本；新增重複檔名回歸測試。
- **保護 Android 共享儲存檔案寫入**：外部 `.py` 檔執行前同步與批次備份都改用同目錄暫存檔、fsync、POSIX 原子替換及寫後讀回驗證，避免 `writeText` 直接截斷原檔；工作區與共享儲存共用寫入鎖。
- **同步加固外部 Termux Bridge**：外部 Python Bridge 現在也會在寫入工作區前取得唯一操作鎖，使用 fsync＋原子替換，並在程序啟動前保留 Stop 狀態；安裝、Shell 與腳本執行共用互斥鎖。原生 Bridge 則先保留執行權並回報串流就緒，再進行檔案 staging；Stop 端以同步快照讀取程序狀態，避免啟動交界漏接停止請求。
- **手機／平板自適應工作區與設定導航**：工具入口統一為設定，設定首頁只顯示 Termux、套件管理、Android 管理、個人化與設定四個分類；手機採單工作區導覽，平板保留編輯器與終端機／檔案／瀏覽器的雙欄分割工作區，並依螢幕尺寸與觸控裝置特徵辨識橫向手機，避免誤判為平板；所有尺寸均採 Android 觸控操作與全面屏安全區適配；設定分類名稱與說明統一使用繁中、簡中、英文及日文翻譯，並修正 Stop 橋接回歸檢查中已過期的原生訊息斷言；分類頁返回操作亦已加入四語系翻譯
- **修正套件管理回歸檢查**：測試斷言同步改用設定分類的多語系鍵 `neg_category_packages`，並驗證分類標題與說明均有翻譯；Android 返回鍵檢查亦同步支援先逐層返回設定分類、再關閉抽屜並恢復原工作區的實際流程。
- **追查非預期停止並防止套件還原誤觸中斷**：停止請求記錄來源（手機／平板頂欄）與當時操作類型，原生 Bridge 同步記錄請求來源；套件還原期間點擊停止會先二次確認，避免一次誤觸就終止 APT 還原。移除「User requested Stop」這種無法證明操作者意圖的誤導日誌。
- **重整手機／平板執行控制列**：暫停、繼續與停止統一放在工作區頂欄，終端機不再重複顯示第二套執行按鈕；執行中鎖定引擎切換，停止期間保留停止中狀態。停止意圖會先鎖住尚未啟動的舊腳本，並等待原生橋接確認執行請求已接收，再停止程序並等待整個啟動／執行流程與串流全部收尾，才重新開放 Run；原生橋接也會處理程序啟動中的停止請求，主動停止不再記為腳本錯誤。
- **改善 Android 首次啟動權限與初始化診斷**：首次載入工作區後主動提示共享儲存權限（只自動提示一次，拒絕後仍可從檔案功能重新請求）；Python 首次初始化失敗時保存並顯示最後錯誤輸出，避免只看到退出碼 1。
- **修復腳本停止競態與手機暫停控制**：停止時先等待 Android 原生程序樹退出及串流工作完成清理，再等待舊串流釋放執行鎖；若原生停止失敗，不會提前清除執行狀態或允許新腳本搶跑。手機與平板終端機同步接收暫停／繼續狀態，Android 暫停與繼續會作用於整個 shell／Python 子程序樹，而非只發送訊號給外層 shell。
- **設定入口統一**：左上角只保留設定齒輪按鈕；Termux、套件管理、Android 管理與個人化設定全部從設定首頁進入，不再在第一層並列其他工具入口。
- **工具中心資料夾導覽回歸檢查**：新增檢查，確保 Termux、套件、Android 儲存與設定均維持資料夾／文件層級、返回保留父層，且所有語系都有資料夾名稱。
- **統一工具中心的資料夾／文件導覽**：Termux 分為環境執行與維護橋接，套件分為 Termux 原生與 Pyodide 沙盒，Android 儲存分為裝置管理與工作區同步；點開文件後全屏顯示，返回保留原資料夾位置，並顯示父層路徑。
- **Android 沉浸式系統列與安全區適配**：原生 WebView 啟用 edge-to-edge，狀態列與導航列透明並保留系統圖示；透過 WindowInsets 將頂部／底部安全距離同步至前端，主題切換時同步調整系統圖示明暗，避免內容被瀏海、狀態列或手勢導航區遮擋。
- **修正設定資料夾命名**：外觀資料夾使用獨立的多語系名稱與說明，不再沿用「介面主題」項目的標題。
- **放寬 APK 匯出簽名測試的換行比對**：同時接受跳脫換行與模板展開後的實際換行，避免測試因字串表示形式不同而誤報。
- **設定中心資料夾導航**：設定首頁改為外觀與個人化、編輯器、應用程式與維護三個資料夾；資料夾內再列出設定文件，使用全屏工作區取代側邊抽屜式呈現。工具列表改為緊湊的觸控友善行列表。
- **更新日誌版本隔離**：GitHub Release 發布時只擷取最新正式版本的單一日誌區段；App 讀取既有 Release 時也會過濾整份歷史日誌，只顯示最新版本區段。已安裝版本只在存在完全相符的版本紀錄時顯示，否則明確提示沒有該版本日誌。
- **終端機可獨立重新執行腳本**：終端機工具列新增執行／停止控制；閒置時可直接重跑目前選定的 Python 檔案，Termux 執行期間顯示停止按鈕，停止後恢復執行入口，不必切回編輯器。
- **統一外部 Android Python 檔案的執行前保存**：無論選用 Termux 或 Pyodide，從共享儲存空間開啟的 `.py` 檔都會先將編輯器最新內容寫回原始路徑，再開始執行，避免切換執行引擎時外部檔案仍保留舊內容。
- **Android 檔案頁直達共享儲存空間**：原生 Android 使用者進入「檔案」後直接看到裝置資料夾與 Python 腳本，不再先進入工作區清單、再額外點一次「瀏覽裝置檔案」；關閉裝置瀏覽器仍可返回工作區檔案。
- **移除隱藏式邊緣滑動設定手勢**：設定只透過清楚可見的頂部入口開啟，避免與 Android 返回／側滑手勢衝突或意外觸發。
- **手機編輯器檔案切換與工具列重整**：以單一檔案選擇器取代需要橫向滑動的多檔案標籤，常用建立、格式化、搜尋與符號鍵盤操作統一採用至少 44px 觸控區，減少檔案多時的尋找成本與誤觸。
- **手機檔案頁減少重複標題**：工作區頂欄已顯示目前所在頁面，檔案工具列改為聚焦檔案數量與建立／同步操作，避免同一頁面名稱重複佔用空間。
- **手機工作區情境式頂欄**：頂部標題隨編輯器、終端機、檔案與瀏覽器切換；只有編輯器顯示執行按鈕，執行中的停止／互動輸入取消操作則持續可見，避免在不相關頁面出現多餘操作。
- **將瀏覽器預設首頁改為 Google**：新安裝與空白網址欄預設開啟 `https://www.google.com/`；既有安裝若仍使用舊的內建示範首頁，升級時自動切換為 Google，使用者自行設定的其他網址則保留。
- **設定面板返回導覽與瀏覽器載入診斷**：設定面板切換工作區時會同步關閉抽屜，避免遮罩殘留；原生瀏覽器新增主頁面載入起訖時間、主框架錯誤與 SSL 取消紀錄，先量測網頁等待時間再針對真正瓶頸優化，避免盲目停用快取或降低安全性。
- **序列化沙盒套件操作**：套件安裝、移除、單項更新、批次更新、自動還原與清單刷新共用同步操作鎖，避免快速連點或工具箱重新掛載時同時操作 micropip。
- **SSL 憑證修復保留使用者 pip 設定**：更新 CA 憑證時只調整 pip.conf 的 `global.cert`，保留自訂索引、鏡像、其他選項與原有檔案權限，並以原子替換避免截斷設定檔。
- **首次初始化與 Termux 操作互斥保護**：首次使用前若無法確認內嵌 Python 狀態，現在會停止安裝並提示連線錯誤，不再錯誤地當成初始化成功；新增同步操作鎖，避免套件安裝／移除、備份還原、終端命令、Python 執行及背景／批次套件升級互相重疊；升級前的套件盤點也會先取得鎖，巢狀執行則沿用既有鎖；程序清理器不會中斷作用中的 Termux 任務，暫停／繼續控制也只作用於 Python 腳本，避免預檢期間發生競態或重複鎖定。
- **修正沙盒套件安裝中途重開工具箱的狀態遺失**：搜尋列安裝按鈕改讀取 App 層的執行狀態顯示旋轉圖示；套件目錄的安裝與移除操作也同步鎖定，避免工具箱重新掛載後仍可重複送出操作。
- **修復工具箱手勢與套件安裝狀態**：分類橫向滑動不再觸發工具箱關閉；Termux 與沙盒套件安裝狀態提升至 App 層管理，關閉後重新開啟工具箱仍會顯示正在安裝的套件與旋轉指示，並停用重複安裝操作。
- **改為 Python 首次使用自動初始化**：首次執行 Python 或從套件中心安裝套件時，內建 Android 環境才自動安裝必要的 `python` 與 `python-pip`；不再預裝 clang、lxml、libxml2/libxslt 或 requests 等非必要套件，其他依賴由使用者按需安裝。
- **修正 CI 分支觸發規則與重複執行**：PR 檢查不再限制目標分支只能是 main/master，堆疊式 PR 也會自動執行測試與建置；同一 PR 有新提交時會取消過期檢查，只保留最新版本驗證，正式分支與標籤發布不會被取消。
- **修正手機導覽圖示匯入**：補上套件導覽使用的 Package 圖示匯入，並以 TypeScript CI 防止遺漏圖示造成整個建置中止。
- **加固套件備份還原**：還原前驗證 APT 套件名稱，跳過備份檔中不合法的項目，避免不可信清單內容進入 shell 命令；多份備份同時存在時優先採用最新成功寫入的清單，套件數量只作為時間相同時的判斷依據。
- **統一 APT 原生 Python 套件清單與更新路由**：健康檢查會避免將已由 Termux APT／TUR 提供的 Python 發行套件重複列為 pip 套件；pip 更新與移除會辨識實際已安裝的原生套件，避免用 pip 覆蓋或錯誤移除系統套件。SciPy 也補入外部 Termux 的原生預編譯安裝對應。
- **套件中心來源與手機操作優化**：Termux 套件卡片明確標示 Termux APT、預設 PyPI（保留使用者自訂 pip.conf）或第三方 TUR；保留套件相容提示，將安裝／移除及分類篩選觸控區提高至至少 44px，並移除套件清單內層固定高度捲動，統一由頁面捲動。
- **修正 TUR Polars 安裝狀態與移除路由**：Polars 由 TUR 安裝為原生 `python-polars` 套件；套件中心改為讀取 APT 安裝清單判斷狀態，移除時改用 `pkg uninstall`，避免錯誤呼叫 `pip uninstall polars`。
- **釐清 Parsel 執行環境相容方式**：外部 Termux 使用 `w3lib<2.6`；APK 內建環境使用 Frostwork 純 Python 相容層支援 `w3lib 2.6+`，避免混淆兩種安裝路徑。
- **補齊檔案與終端機細部觸控尺寸**：檔名編輯、刪除確認、備份同步、範本分類及終端機圖表工具列也統一採用較大的觸控區。
- **終端機觸控優化**：將執行環境切換、暫停／繼續、複製、清空、初始化及互動輸入控制提高至至少 44px，改善手機操作手感。
- **檔案管理觸控優化**：提高 Android 儲存快捷列、檔案重新命名／刪除、備份還原等常用操作的觸控高度，降低手機上的誤觸。
- **主題選擇器整理**：所有四字主題名稱統一置頂，色彩預覽置於下方；改為雙欄緊湊排列，保留全部主題與原有色彩，並移除冗長副標以便快速辨識。
- **主題預設與排序**：新安裝預設使用「極夜深灰」；主題選單按版本加入時間由舊至新排列，保留全部既有主題與配色。
- **精簡重複設定**：保留原有全部內置主題與配色；移除編輯器設定中重複的沙盒開關，沙盒啟用狀態統一在套件管理頁控制，並刪除重複的啟用按鈕。
- **手機版四大工作區導覽**：底部固定保留編輯器、終端機、檔案與瀏覽器四個高頻入口；套件管理、執行環境、儲存與維護等低頻功能統一從「設定」進入，不再把工具箱或套件中心當成第五個工作區。
- **外部 Python 檔案直接開啟與執行**：檔案頁可全螢幕瀏覽 Android 共享儲存空間中的資料夾與 `.py` 檔，點選後直接載入編輯器；執行前先將最新編輯內容寫回原始資料夾，再交由 Termux Python 執行，保留原始檔案位置。
- **輕量化外部檔案管理**：在檔案瀏覽介面可建立資料夾與 Python 腳本、重新整理清單、進入子資料夾及刪除項目；隱藏不常用的工作區備份與快取維護按鈕，讓主要操作更清楚。
- **明確保留 Python 官方 PyPI 套件索引**：APK 內建環境與外部 Termux Bridge 的 pip 設定都明確以 `https://pypi.org/simple` 作為預設索引；Termux APT 原生預編譯路由仍優先處理已確認的 Android 套件，第三方 wheel 不會覆蓋 PyPI 預設來源，並須驗證 Android／Python ABI。外部 Termux 若已有使用者自訂 `pip.conf`，DroidPy 不會覆寫私有索引或憑證設定，新環境才建立 PyPI 預設設定。
- **擴充官方 Termux ARM64 預編譯套件目錄**：新增 psutil、msgpack、gRPC、Brotli、bcrypt、PyCryptodomeX、APSW、TensorFlow Lite Runtime、PyTorch、TorchVision、TorchAudio 等原生套件，並將 yt-dlp 改為官方預編譯套件；終端機、套件管理介面與備份還原共用相同套件名稱對應。PyTorch 系列標示為按需安裝，不預先塞入 APK。
- **統一終端機與套件管理介面的官方預編譯路由**：直接輸入 `pip install numpy`、`pandas`、`matplotlib`、`pillow`、`lxml`、`cryptography` 等單一套件時，APK 內建與獨立 Termux Bridge 現在都會優先改用 Termux APT 預編譯套件；版本限制、extras、多套件與 requirements 命令不會被錯誤改寫。
- **調整 Pandas 與 Matplotlib 的 Android 安裝來源**：套件目錄與一鍵安裝提示統一使用 Termux 預編譯 `python-pandas`／`matplotlib`，避免 pip 在手機上重複編譯 NumPy、pandas 或 contourpy 等原生依賴。
- **集中管理 Android 套件相容路由**：APK 內建 Bridge 與獨立 Termux Bridge 都將 Parsel、SciPy、Polars 的特殊安裝規則集中管理；scikit-learn 因缺少已驗證的 Android ARM64／Python 3.14 預編譯版本，兩種環境均改為明確提示不可安裝，APK 內建環境使用 Frostwork 純 Python 相容層，獨立 Termux 環境保留安全的 w3lib 相容限制，避免兩種執行環境混用不適用的模組。
- **新增 Android 純 Python Frostwork 相容替代層**：APK 啟動時將本地相容模組與套件中繼資料種入 DroidPy 使用者匯入路徑，支援 w3lib 2.6 所需的 `navigation()`、常用 CSS／XPath 選擇器、多欄位文字／屬性擷取；無法支援的選擇器會明確報錯，不要求 Rust／Maturin 編譯，也不覆蓋已安裝的上游 Frostwork。此版本以相容性與功能覆蓋為優先，並非 Rust 版本的效能或完整 API 等價物。
- **修正正式版與 Beta 並存時的本機 Bridge 連接埠衝突**：正式版維持 `127.0.0.1:8765`，Beta 改用 `127.0.0.1:8766`；Android 原生端點會同步提供給前端，避免 Beta 啟動時因正式版仍佔用 8765 而閃退或連錯服務。
- **修正 Android 11 以上儲存授權與實際 target SDK 不一致**：只有 App 本身 targetSdk ≥ 30 時才開啟「所有檔案存取權」設定；目前 DroidPy targetSdk 28，在 Android 11+ 仍使用相容的 READ/WRITE 執行期授權。Native Bridge、Termux Bridge、儲存狀態 API 與共享資料夾初始化也統一依 target SDK 判斷，避免授權已成功卻被錯誤回報為未授權。
- **擴大 Android 測試版啟動診斷範圍**：從 Activity 建立、主／爬蟲 WebView 初始化、工作區準備到 Bridge 啟動逐階段輸出 Logcat；未捕獲例外同步輸出完整堆疊至 `DroidPy` 標籤，避免只留下無法定位的閃退現象。
- **讓 Android 啟動診斷可從 Logcat 讀取**：原有啟動階段紀錄只寫入 App 私有檔案，啟動早期閃退時無法直接從 Termux 的 Logcat 觀察；現在同步輸出到 `DroidPy` 日誌標籤，並明確記錄內嵌 Bridge 啟動前後及失敗堆疊，方便定位 Beta 閃退階段。
- **修復內嵌 Android Bridge 用戶端斷線造成工作執行緒崩潰**：客戶端提前關閉連線時，`writeJson`／`writeHeaders` 的 `Broken pipe` 現在會被視為正常請求結束，不再讓未捕獲的 `IOException` 以 `FATAL EXCEPTION` 終止整個 App；加入回歸檢查。
- **修復首次啟動授予儲存權限後可能崩潰的流程競態**：不再於 `onCreate` 尚未完成 WebView／Termux Bridge 初始化時自動跳轉系統設定；改為使用者實際操作儲存功能時才請求授權。只有 targetSdk ≥ 30 的版本在 Android 11 以上使用「所有檔案存取權」設定；目前 targetSdk 28 的版本在 Android 11+ 仍使用相容的 READ/WRITE 執行期權限，並加入診斷紀錄。
- **測試版與正式版可並存**：未發布 APK 的版本名稱加上 `-Beta`，Debug 變體使用獨立 `.beta` 套件 ID，FileProvider authority 隨變體套件 ID 變化；正式版套件 ID、簽名與 Release 發布流程維持不變。
- **修正 Android 終端機絕對 Python 路徑漏接套件相容流程**：現在 `/data/user/.../python3 -m pip install polars` 等完整路徑命令也會辨識並導向 Termux 原生套件，不再誤觸 pip/maturin/Rust 編譯；外部 Termux Bridge 同步修正。
- **統一終端機與套件管理介面的 Android 套件相容路徑**：直接輸入簡單的 `pip install parsel`（含 `python -m pip`）也會先安裝 Termux 原生 `python-lxml`，並透過 DroidPy 純 Python Frostwork 相容層支援 `w3lib>=2.6`，不再需要舊版 `w3lib<2.6` 限制或 Frostwork/Rust 建置；外部獨立 Termux Bridge 保留原有相容路徑。
- **修正 SciPy 在 Android 上的安裝路由**：套件目錄與終端機直接輸入 `pip install scipy` 改走 Termux 預編譯 `python-scipy`，避免 pip 嘗試從原始碼建置 NumPy／SciPy。
- **第三方 APT 來源安全審查**：雖有社群倉庫宣稱提供預編譯 scikit-learn，但其安裝腳本以 `trusted=yes` 加入 APT 來源，會略過套件庫簽章驗證；DroidPy 不會為了讓套件可安裝而關閉 APT 信任驗證，也不會自動加入該來源。
- **停用 scikit-learn 手機端原始碼編譯**：目前官方 Termux ARM64 套件庫未提供可確認的 Python 3.14 預編譯版本；已找到的第三方 wheel 只有 CPython 3.12，且其 Linux ARM64 標籤不能保證 Android 相容，因此不再自動下載原始碼並於手機上編譯，改為明確回報尚無相容預編譯套件，避免再次以 Ninja 失敗收場。
- **新增 Polars Android 原生安裝流程**：直接輸入 `pip install polars` 時，自動加入已簽署的 Termux User Repository（TUR）並安裝預編譯 `python-polars`，避開 Android 不支援的 pip/maturin/rustup 編譯路徑；套件目錄一鍵安裝與備份還原同步支援。
- 更新 scikit-learn 與 Polars 的 Android 相容性提示，清楚區分 TUR 第三方套件來源與 scikit-learn 本機原生編譯限制。

- 修正 Termux 橋接頁面顯示的初始化指令：明確安裝 `python-pip` 與原生 `python-lxml`，不再展示會讓使用者誤以為應以 pip 編譯 lxml 的舊指令。
- 補充 `metadata` 套件名稱與標準庫 `importlib.metadata` 的差異。
- **修復 Android Termux 的 Parsel 安裝相容性**：Parsel 安裝先使用 Termux 預編譯 `python-lxml`，並將 `w3lib` 限制在 `<2.6`，避免新版 `w3lib 2.6.0` 引入目前不支援 Android/Bionic 目標的 Frostwork Rust 擴充編譯依賴。

### Fixed — Atomic Termux package backup manifests
- **避免套件備份清單在 App 中斷時被截斷或損壞**：主儲存與外部備份現在先寫入同目錄暫存檔、同步落盤後再以原子 rename 取代舊檔；寫入失敗時保留既有清單並記錄診斷結果。
- 新增回歸檢查，確保兩份套件清單都不再使用直接覆寫。


### Fixed — Termux process survival after client disconnect
- **避免 Termux 原生 Python 工作因網頁串流斷線被誤殺**：用戶端中斷後，Bridge 改為停止傳送輸出但持續讀取／排空 PTY，讓使用者腳本可以自然執行完畢；只有明確呼叫授權的 /stop 才會終止程序。
- 新增回歸檢查，確保斷線路徑不再對程序群組發送 SIGKILL，且明確停止路由仍保留。


### Fixed — Native browser bridge and Cookie capture
- **修復原生瀏覽器「前往」呼叫失敗**：呼叫 `@JavascriptInterface` 方法時保留注入的 `DroidPyNative` 物件作為呼叫接收者，避免 Android WebView 回報 `Java bridge method can't be invoked on a non-injected object`。
- **補強 APK 原生 Cookie 擷取**：擷取前驗證目前網址，成功讀取後同步至 IDE 事件與工作區 `cookies.json`；沒有 Cookie 時不再默默關閉瀏覽器，而是提示使用者確認登入狀態。寫入及事件派送失敗會顯示錯誤。
- **增加原生診斷日誌**：記錄 Cookie 按鈕點擊、擷取開始／完成／無 Cookie／失敗及事件派送結果；不記錄 Cookie 值或登入憑證。
- **更新 README**：釐清 Pyodide 與 Termux 的執行環境差異，更新 APK 原生瀏覽器安全邊界及 Cookie 擷取說明。


### Fixed — Native browser address-bar navigation
- **修復 Android APK 網頁預覽按下「前往」沒有反應**：獨立 APK 的預覽畫面使用隔離的原生 WebView，而非一般瀏覽器的 iframe；原本地址列只更新 iframe 狀態，但 APK 畫面仍停留在提示頁。現在地址列送出、快速網址預設與「開啟原生瀏覽器」統一導向原生 WebView，並清除舊的 HTTP 探測結果，確保新網址立即開啟。
- 補上原生瀏覽器導航分流與舊探測結果清理的回歸檢查。


### Fixed — Android runtime stability, bridge concurrency, and diagnostics
- **修復橋接請求互相阻塞**：內建 Android Bridge 的核心工作執行緒由 1 增至 4（最多 8），長時間執行 Python、pip 或 pkg 時，健康檢查、標準輸入、備份與停止請求仍可獨立處理；避免 SD 卡備份因排隊而假性逾時。
- **避免網頁串流斷線誤殺 Python**：串流用戶端斷線時，原生程序不再因輸出寫入失敗而直接 destroyForcibly；改為持續收集輸出尾段並等待程序自然結束。真正停止程序仍由明確的 /stop 請求負責。
- **修復 Activity 重建時橋接服務被重複建立**：同一 Android 程序內保留 EmbeddedTermuxBridge，設定變更／Activity 重建時重用既有橋接，不再因 onDestroy 關閉串流與中斷程序；橋接關閉改為平順排空已接收請求。
- **補強未知崩潰診斷**：記錄未捕獲例外的完整堆疊、Activity 銷毀原因、程序 PID／命令／退出碼、實際腳本名稱及 SD 卡備份耗時／錯誤，避免只看到模糊的 exit code 或逾時訊息。
- **改善備份錯誤辨識**：SD 卡批次備份等待時間提高至 30 秒；逾時訊息會指出實際橋接路徑，不再把一般儲存請求誤稱為 Python 執行逾時。
- 新增 Bridge 併發、程序生命週期、斷線行為、Activity 重建與診斷日誌的回歸檢查。


### Fixed — Termux execution ownership and crawler browser sessions
- **避免重複啟動互相中斷腳本**：Termux 串流請求不再因第二個操作自動取消第一個工作；已有工作時明確拒絕新的串流請求，只有使用者明確按下停止才會中斷目前串流。明確停止造成的 HTTP Abort 不再偽裝成 Python 程序退出碼 130，讓真正的 SIGINT／程序退出碼保留診斷價值。
- **修復爬蟲 Cookie 匯入與跨網域覆蓋**：Cookie 合併改以名稱、Domain、Path 作為識別，避免不同子網域或路徑的同名 Cookie 互相覆蓋；匯入與匯出保留 HttpOnly、Secure、SameSite、Expires／Max-Age 等可取得屬性，Netscape cookies.txt 也會保留安全旗標。
- **修復 Python 爬蟲工作階段還原**：產生的 `crawler_session.py` 會從 `cookie_list` 建立具 Domain／Path／Secure／Expires 屬性的 Requests CookieJar，同時相容舊版只有 `cookies` 字典的 `cookies.json`。
- **強化內建 Android 瀏覽器安全性**：限制地址列只載入有效 HTTP／HTTPS 網址，停用本機檔案與 Content URI 存取及混合內容，明確拒絕 TLS 憑證錯誤；外部頁面仍在獨立瀏覽器 WebView 中執行，不會取得主 IDE 的原生 JavaScript Bridge。
- **新增串流所有權、Cookie 範圍、Cookie 匯入／匯出及產生 Python 腳本的回歸檢查**；Android 實機瀏覽器登入與 Cookie 擷取仍需新版 APK 驗證。


### Fixed — Native package restore and terminal package aliases
- **修正備份還原錯把原生套件交給 pip 編譯**：還原時依照 Termux 原生套件對照表，先以 APT 安裝 NumPy、pandas、Pillow、lxml、cryptography 與 matplotlib，再把其餘純 Python 套件交給同一個 Termux Python 的 pip；避免 NumPy／pandas 等大型原生套件在 Android 上從原始碼建置。
- **修正終端機套件名稱別名**：直接輸入 `pkg install pandas`、`pkg install numpy` 等簡單套件命令時，自動改用 Termux 實際套件名稱（例如 `python-pandas`、`python-numpy`），並保留多套件與既有安裝旗標；複雜 shell 指令不做危險改寫。
- **改善 pip 備份還原的 wheel 優先策略**：剩餘 pip 套件使用 `--prefer-binary`，在有相容 wheel 時優先選擇，並對備份清單中的不合法套件名稱採取安全跳過。
- **補上原生套件還原與終端機命令回歸檢查**。


### Fixed — Android updater permission flow and terminal stability
- **修復首次更新未自動引導安裝權限**：更新 APK 完成驗證後，若 Android 尚未允許 DroidPy 安裝未知來源應用程式，會保存已驗證 APK 路徑並直接開啟本 App 專屬的權限設定；使用者返回且授權後，透過 Activity resume 自動接續系統安裝器，不必重新下載。
- **修復原生終端機命令輸出阻塞**：不再先以無上限的 `readText()` 讀取子程序輸出、之後才等待逾時；改為輸出導向 App 私有暫存檔、先執行逾時等待、最多回傳最後 2 MiB，並回報逾時與啟動錯誤，避免大量輸出或長時間命令拖垮記憶體／卡住請求。
- **降低終端機 `pkg install` 的互動卡住風險**：使用者直接輸入 `pkg install xxx` 時，若未指定 `-y`／`--assume-yes`，Bridge 會補上非互動確認參數；保留使用者已指定的選項，避免沒有 TTY 的原生命令流停在確認提示。
- **改善套件命令辨識與清理判斷**：只將真正的 pkg／apt／pip 命令視為套件操作，避免僅因參數或套件名稱含有相似字串就觸發套件備份與快取清理；補上更新權限恢復及命令輸出上限回歸測試。
- **新增腳本暫停／繼續**：終端機執行原生 Termux 腳本時可暫停與恢復目前程序；內嵌 Android Bridge 使用程序訊號控制，匯出的 Python Bridge 使用獨立程序群組的 SIGSTOP／SIGCONT，不會把暫停誤當成停止或終止。
- **補齊套件目錄安裝策略**：套件目錄每個項目都明確標記 Termux 的 pip／pkg 安裝路徑；SciPy、scikit-learn、Polars 明確保留 pip 路徑並提示 Android 原生輪子／編譯限制，不再讓套件項目因缺少 Termux 設定而走不明確的預設流程；新增全目錄路由完整性檢查。


### Fixed — Native Termux package routing and Python archive installs
- **修正 matplotlib 在 Android 上的安裝方式**：將 `matplotlib` 自動導向 Termux 原生 `pkg install matplotlib`，避免 pip 下載大型 `.tar.gz` 後再長時間建置 `contourpy` 等原生相依套件；同步套用至匯出的 Termux 執行包及套件目錄提示，並加入安裝路由回歸測試。
- **避免 Android 上對原生擴充套件進行漫長的 pip 原始碼編譯**：NumPy、pandas、Pillow/PIL、lxml 與 cryptography 優先使用內嵌 Termux 預編譯套件，並同步擴充至匯出的 Termux 執行包，避免 App 與匯出腳本採用不同安裝策略。
- **正確辨識 Python 套件檔案格式**：`.whl`、`.tar.gz`、`.tgz`、`.tar.bz2`、`.tar.xz`、`.zip`、`.egg`、requirements 輸入與 Git editable 安裝交由 pip；若誤選 pkg，會自動切換至 pip，避免把 Python 壓縮套件交給 apt/pkg。系統 `.deb` 套件仍保留 pkg 路徑。
- **優先選擇預編譯 wheel**：pip 安裝加入 `--prefer-binary`，有相容 wheel 時優先使用，只有沒有可用 wheel 時才退回原始碼建置；明確指定的 `.tar.gz` 原始碼包仍依套件本身需求建置。
- **保留使用者指定條件**：版本限制、extras、URL 與多套件字串不擅自改寫；安裝日誌顯示實際執行的安裝方式。


### Fixed — Termux package restore & mobile run controls
- **修正手機套件安裝與腳本執行的 Python 環境一致性**：Termux 套件還原及一般 pip 安裝改用內嵌 `python3 -m pip`，確保安裝位置對應執行腳本的直譯器；NumPy 改由 Termux 預編譯套件 `python-numpy` 安裝，並以同一個 Python 執行 `import numpy` 驗證，安裝或驗證失敗會明確回報失敗，不再靜默略過或讓 pip 長時間編譯 NumPy。
- **整合手機版執行／停止操作**：將執行與停止狀態切換集中到右上角頂欄，從終端機輸入列移除重複的停止按鈕，避免操作入口分散。
- **避免不完整套件清單觸發錯誤還原**：Python 尚未就緒或 pip 清單查詢未完成時，不再把空清單當成所有備份套件都遺失；先恢復必要的 Termux 原生套件，明確提示初始化 Python 後再重試 pip 還原，並在狀態 API 回報兩種清單的完整性。


### CI — Improve release signing diagnostics
- 新增解碼後 keystore 原始位元組 SHA-256 比對，確認 GitHub Secret 是否與離線原始套件完全一致；擴充 keytool 無 stderr 時的合併輸出診斷，將簽名故障定位到具體原因。
- 正式簽名載入前先正規化 Base64 空白，輸出不含 Secret 的解碼檔案大小；keytool 失敗時提供安全診斷，並強制核對預期 SHA-256 指紋，防止錯誤金鑰被用於正式 APK。
- 更新 APK 更新器回歸檢查，覆蓋簽名金鑰指紋固定驗證與診斷路徑。

### Security — Rotate DroidPy Release signing key
- **正式簽名金鑰輪替**：正式 Release 不再接受或鎖定歷史公開的舊簽名憑證，改由專用 GitHub Actions Secrets 提供新 keystore；CI 從該 keystore 動態取得 SHA-256 指紋，並逐次驗證 Release APK 確實由同一把金鑰簽署。
- **修復 PR APK 打包失敗**：PR／Debug 建置不再要求正式 Release Secrets，使用 Android Debug 臨時簽名產出測試 Artifact；合併至 main/master 後的正式建置才要求新 keystore。
- **合併後自動發布**：保留 main/master push 自動流程；只有測試、Release APK 編譯、簽名驗證及 Artifact 上傳全部成功後，獨立 Release 工作才會建立或更新 GitHub Release。
- **簽名輪替相容性提醒**：新憑證與歷史安裝版本不同，舊版 APK 無法直接覆蓋更新；使用者須先匯出 App 資料備份，再解除安裝舊版並安裝新 Release，之後使用 App 內功能還原資料。
- **保護新私鑰**：新 keystore 不會寫入原始碼或提交至 Git；正式發布所需的 Base64、密碼及 alias 僅由 GitHub Actions Secrets 提供。請離線保管 keystore 與憑證資料。

### Security — Shared-storage state backup credential protection
- 修正 Android 狀態備份的失敗回退：若狀態 JSON 無法解析或無法完成憑證清除，現在會跳過本次共用儲存空間備份，保留上一份有效快照；不再把未清理的原始 JSON 寫入共用目錄，避免意外暴露每次安裝專屬的 Bridge token。
- 新增 Bridge 回歸檢查，確保備份清理採 fail-closed 行為，且不會在解析失敗時回退寫入原始狀態。


### Fixed — Exported Android project signing instructions
- Corrected the generated Android project README: production Releases require the protected GitHub Actions keystore Secrets, Debug artifacts use an ephemeral signer, and upgrade compatibility requires the original signing keystore. Removed the obsolete claim that the exported project automatically uses a bundled fixed signing key.

### Security — Bridge request resource limits
- **限制 Python Bridge 併發連線**：最多 8 個處理中的請求、佇列最多 16 個；超出容量回覆 503 並關閉連線，避免無限制建立執行緒。
- **限制原生 Android Bridge 資源**：使用最多 8 個工作執行緒與 16 個排隊請求；拒絕超額連線，HTTP 標頭限制 16 KiB、JSON 請求本文限制 8 MiB，讀取逾時維持 15 秒。 停止 Bridge 時會關閉所有已接收的用戶端 socket，避免快速重啟留下等待中的工作執行緒。
- **嚴格檢查請求框架**：拒絕 Transfer-Encoding、重複 Content-Length、無效長度、不完整本文及無效 JSON；Bridge 停止時只關閉請求處理器，不會終止使用者正在執行的 Python 工作。
- 加入 Python 產生碼與 Android 原生 Bridge 的資源上限及生命週期回歸檢查；Android 實機驗證仍待完成。
- 新增備份儲存回歸測試：驗證 localStorage quota 失敗與資料損壞時不覆蓋舊備份、匯入／刪除保留其他快照，以及還原前必須先成功保存 pre-restore 回復點。
- **強化 APK 更新下載與簽名相容性驗證**：僅接受 GitHub 官方 HTTPS 資產網域並逐跳驗證重新導向；下載上限 300 MiB、先寫入並同步暫存檔，確認完整性後才替換舊 APK；比對套件 ID 與目前安裝版本的簽名憑證／有效單簽名輪替歷史，不再硬編碼已過時的舊憑證指紋。
- **Release 簽名驗證改為跟隨受保護 keystore**：不再固定比對已過時的舊憑證指紋；CI 會從本次 Release 使用的 GitHub Actions secret keystore 匯出憑證指紋，再與 APK 簽名比對，允許安全輪替簽名金鑰，同時保留缺少／不匹配金鑰即阻止發布的 fail-closed 行為。
- **修正匯出 Android 專案的自動發布流程**：Debug 使用臨時 Gradle 簽名並只上傳 Artifact；正式 Release 必須使用受保護 GitHub Secrets keystore、建置 Release APK 並驗證 APK 憑證與該 keystore 一致；Release 發布移至獨立 write 權限工作，移除不存在的內嵌簽名檔 fallback。


### Security — URL Probe SSRF Protection (pending Android validation)
- **雙端阻斷私有網路探測**：Python Bridge 與 Android 原生 Bridge 都會解析 DNS、拒絕非公網／保留 IP，並直接連線至已驗證的 IP，避免 DNS rebinding 在檢查後改指向內網。
- **逐跳驗證重新導向**：停用自動跳轉，每個 redirect 目標都重新解析及驗證；跨來源跳轉不轉送 Cookie、Authorization 或 Referer。
- **限制探測標頭與回應**：拒絕 Host、連線控制與 Cookie 覆寫標頭，限制標頭大小、回應預覽和逾時；HTTPS 保留憑證及主機名稱驗證。
- 加入私有 IP、DNS pinning、loopback redirect、跨來源憑證剝除與標頭注入回歸測試；Android 實機驗證仍待完成。

### Fixed — Termux 套件清單、使用者套件路徑、備份與資料保護（待 Android 實機驗證）
- **完整盤點 Python 套件**：不再因檔案掃描已找到一個套件（例如 lxml）就跳過 `importlib.metadata.distributions()`；同時核對 `usr/` 與 `PYTHONUSERBASE`，避免漏掉使用者安裝的套件。
- **限制盤點子程序資源**：輸出改寫入 App 私有暫存檔，不再使用可能塞滿的 pipe；Android 8 以上最多等待 8 秒、輸出限制 1 MiB，並在結束或失敗時清理程序與暫存檔。
- **保護套件備份清單**：一般掃描只合併清單，不會因不完整結果縮短備份；只有明確解除安裝，而且 Python 與 dpkg 兩份盤點都確認完整時，才允許縮減清單。
- **保護既有 `usr/`**：若啟動時核心標記或二進位檔遺失，但 `usr/` 仍有資料或無法安全讀取，就跳過破壞性的重新解壓，先嘗試修復並提示使用者，不會自動刪除原套件資料。
- **修正套件安裝後無法匯入**：兩套 Python `sitecustomize.py` 都會明確啟用 `PYTHONUSERBASE` 的 site-packages 路徑。
- **正規化 Python SSL CA 憑證**：處理 UTF-8 BOM／非 ASCII 註解，重新組合並驗證 PEM 憑證區塊；保留 TLS 憑證驗證，不會因找不到 CA 而關閉驗證。
- **強化 APT 套件來源驗證**：移除允許未驗證套件與不安全來源的選項，停止新增 `[trusted=yes]`，並清理舊版留下的設定；缺少可信 CA 時安全失敗，不會降級成不驗證 HTTPS。
- **加入 CI 回歸檢查**：涵蓋套件雙來源盤點、子程序限制、備份清單完整性、部分 `usr/` 保護、使用者套件路徑、CA 正規化與 APT／TLS 驗證。

### Fixed — Python Process Safety and Bridge Lifecycle
- **停止以執行時間自動終止 Python 工作**：移除 Python／pip 子行程 30 分鐘看門狗與定時清理；程序檢查改為唯讀診斷，不會因執行時間或殭屍狀態自行發送終止訊號。
- **修復 Bridge 停止時誤殺使用者工作**：停止內嵌 Bridge 不再強制終止目前 Python 程序，並保留程序控制代碼，讓 Bridge 重新啟動後仍可由使用者明確停止該工作。
- **同步更新繁中、簡中、英文與日文介面文案**，明確標示程序檢查不會自動終止工作。
- **加入 watchdog 安全回歸檢查**，防止未來重新引入依執行時間清理程序的邏輯。

## [1.2.34] - 2026-11-25

### Fixed — Release pipeline and audit coverage
- 主版與匯出 Android 專案的 Release 版本只從 CHANGELOG 的正式版本標題解析，避免正文中其他版本字串誤導自動發版。
- 將 GitHub Actions checkout/setup-node/setup-python 更新至 Node 24 相容版本，並加入回歸檢查。
- 更新全專案 69 個追蹤檔案的盤點、風險登錄與實際驗證進度；明確標示仍需 Android 10+ 實機驗收的項目。

## [1.2.33] - 2026-11-25

### Fixed — Atomic package backup and version metadata
- 套件備份清單改為同目錄暫存檔寫入、fsync 後原子替換；寫入失敗時保留既有有效清單，並記錄不含敏感資料的診斷訊息。
- 同步前端版本、原生 APK 備援版本、匯出專案預設版本、離線更新清單與 package.json 版本；主 APK 與匯出 APK 的 versionCode 統一為 1.2.33 → 1002033。

## [1.2.32] - 2026-11-25

### Fixed — Termux stream disconnect handling
- 外部 Termux Bridge 在網頁串流用戶端斷線時不再對 Python 程序群組送出 SIGKILL；改為持續排空 PTY 輸出，讓工作自然結束，明確 /stop 仍保留終止權限。

## [1.2.31] - 2026-11-25

### Fixed — Version metadata consistency
- 修正前端 APP_VERSION、原生 APK 預設 versionName／versionCode 及版本查詢失敗回退值仍停留在 v1.2.16／v1.2.14 的問題，統一對齊 v1.2.31，並使主專案與匯出 APK 的 versionCode 使用相同編碼公式（1.2.31 → 1002031）。
- 更新離線更新資訊，加入 v1.2.31 與最新已知正式版 v1.2.30，避免無法連線時仍展示過時版本；同步對齊 package.json／Bun workspace 名稱與套件版本，並修正文檔與 PWA 描述將 Termux Python 誤標為 3.12 的問題。
- 新增回歸檢查，防止前端、原生 APK 與更新資訊再次出現版本分歧。

## [1.2.16] - 2026-11-24

### Fixed & Redesigned (pip Truststore `Errno 13` Deep Fix, Mobile Overflow & Copy Cleanup, Hub -> Dedicated Windows, Realistic 4-Season Sky 3D Backdrop)
- **深度根治 Android Python 3.14 `pip` `truststore` `PermissionError: [Errno 13]`**：
  - 於內嵌 Termux `sitecustomize.py` 植入記憶體內建 CA 憑證文本回退，攔截並防護 `certifi`、`pip._vendor.certifi`、`pip._vendor.truststore._api` 與 `_create_truststore_ssl_context()` 遭遇權限拒絕時改讀記憶體憑證；同步產生 `pip.conf`（`cert` 與 `no-cache-dir`）並於 `repairTermuxRuntime()` 規範 `usr/etc`、`usr/tmp`、`lib/python3.*` 與 `certifi` 目錄權限。
  - 前端 `termuxBridge.ts` 執行期指令一併套用 `PYTHONPATH`、`PIP_CONFIG_FILE` 與 `DROIDPY_DISABLE_TRUSTSTORE=1`，並在維護視窗提供一鍵重建憑證與 `sitecustomize` 工具。
- **重構工具箱為「選項列表 → 獨立操作視窗」**：
  - 將「Python」、「套件」、「儲存」、「設定」內部改為單層精簡選項列；點擊任何項目後僅開啟該功能的專屬獨立視窗，並於頂部配備「← 返回」標題列，大幅降低手機端滑動與尋找成本。
- **精簡冗餘文案並修復手機端文字溢出**：
  - 移除過於繁瑣與學術感的「Python 直譯器」用詞，統一改為精簡自然的「Python／內建 Python」，縮短四語系過長按鈕與描述文案；修復終端機標題列在 360px 窄螢幕擠壓按鈕與內部儲存長按鈕斷行溢出的問題。
- **升級寫實 3D 季節晝夜天空背景**：
  - Three.js 氛圍層依月份自動切換春（落櫻花瓣）、夏（晴朗雲嵐／雷雨漣漪）、秋（脈紋楓葉／暖霞）、冬（六角雪晶）粒子效果，並結合 Rayleigh/Mie 大氣天光著色器與太陽／月亮光暈隨晨曦、晴空、落日與星空自然漸變。

## [1.2.15] - 2026-11-24

### Added & Fixed (CI Release Publishing, Feminine Time-Reactive 3D Background & New Feminine Themes)
- **修復 GitHub Actions 重試與發布資產同名衝突 (`asset under the same name already exists`)**：
  - 統一 `gh release upload ... --clobber` 覆寫語意與 `actions/upload-artifact` `overwrite: true` + `run_attempt` 區隔，徹底解決重跑 Workflow 時 `DroidPy-arm64-v1.2.14-b16.apk` 失敗的問題。
- **修復新版本不發布與更新檢測排序問題**：
  - `.github/workflows/droidpy.yml` 與匯出之 `build-apk.yml` 在打包 APK 前自動比對 `CHANGELOG.md` 與遠端 Release／Git Tag commit；若推送新程式碼未手動遞增版號，CI 會自動遞增修訂版號（如 `v1.2.15` → `v1.2.16`）並同步寫入 `DROIDPY_VERSION_CODE` / `DROIDPY_VERSION_NAME` 與發布全新 GitHub Release。
  - `appUpdater.ts` 新增 `cache: 'no-store'` 與語意版本 (`compareSemver`) 降序排列，確保程式內更新視窗永遠顯示最新穩定版與正確 APK 下載檔。
- **新增浪漫女性化「動態 3D 氛圍背景」（Three.js WebGL）**：
  - 支援隨時間自動變化：晨曦落櫻花瓣飄、晴空／紫羅蘭細雨漣漪、暮色玫瑰花雨、月夜冰晶飄雪與星塵流螢光點，並與當前配色主題自然融合；設定內可自由開關或手動指定飄落效果。
- **新增 4 款女性化主題**：
  - 擴充 **胭脂牡丹 (`peony`)**、**香檳珍珠 (`champagne`)**、**月影薔薇 (`moonrose`)**、**極光粉霧 (`aurorapink`)** 4 套高對比 MD3 與 CodeMirror 語法高亮配色，共提供 14 款主題。

## [1.2.14] - 2026-11-23

### Fixed (Installed Packages Detection, Cache/Temp Cleanup, Control-Char/Garbled Output, `/shell` 404, Mobile Overflow & Long-Session Performance)
- **重點修復「已安裝套件為空」顯示與偵測問題**：
  - `EmbeddedTermuxBridge.kt` `collectInstalledPipNames()` 擴大掃描 `usr/lib/python3.*`、`usr/local/lib/python3.*` 與 `.local/lib/python3.*` 的 `site-packages`/`dist-packages`，並補上 `python -c "import importlib.metadata ..."` 回退驗證；強化 `pip` Wrapper 導出 `PIP_USER=0`、`PIP_BREAK_SYSTEM_PACKAGES=1`、`PIP_NO_CACHE_DIR=1` 與自動清除 `EXTERNALLY-MANAGED`。
  - `TermuxIntegrationPanel` 與 `ToolsAndPackages`（套件頁籤）不再於清單暫為空或沙盒停用時整塊隱藏，並直接展示原生 Termux `pip` / `pkg` 套件清單與刷新／解除安裝操作。
- **修復套件安裝失敗後暫存佔用不減小問題＋一鍵清理**：
  - `EmbeddedTermuxBridge.kt` 與 `MainActivity.kt` 於開機與每次 `pip`/`pkg`/`apt` 指令結束（包含失敗）自動清理 `home/tmp/pip-*`、`.cache/pip`、`usr/tmp_pkg_stage`、`filesDir/usr_tmp`、`apt/archives/*.deb` 與過期更新 APK；新增 `GET /storage/app-usage` 與 `POST /storage/cleanup` 端點及「手機」儲存面板一鍵清理介面。
  - `savePackageBackupSnapshot()` 僅於偵測到非空套件清單時覆寫備份，避免重整期間空白快照覆蓋既有備份。
- **修復腳本亂碼（`□`／`\x1b部`／`8;5;129mm`）並隱藏「純淨文字」按鈕**：
  - `EmbeddedTermuxBridge.kt` `buildEnv()` 強制導出 `PYTHONUTF8=1`、`PYTHONIOENCODING=utf-8`、`LC_ALL=en_US.UTF-8`；`ansiParser.tsx` 與 `stripAnsiForLog()` 全面濾除殘留 ESC、C1 控制碼、`U+FFFD`、雙 `m` SGR 尾端片段。
  - 隱藏終端機與設定中多餘的「純淨文字」切換按鈕，改為自動潔淨輸出。
- **修復 `/shell` 404 與重複開機日誌**：
  - Kotlin 新增原生 `POST /shell` 同步指令端點，`termuxBridge.ts` 補上 `/shell` 404 自動回退 `/shell-stream`，並修正原生 APK WebView 中 SW 重載導致 `DroidPy started` 重複記錄問題。
- **全面修復手機端 UI 字體與按鈕溢出，並優化長時間運行流暢度**：
  - 隔離 250ms 終端機即時計時器、`React.memo` 記憶化每筆輸出與 `renderAnsiText`、限制終端機緩衝列數與單筆長度、`requestAnimationFrame` 合併串流更新、`appLogger` 與 `flushNativeStateNow` 去抖寫盤，並將 Android `writePersistedState` 移至背景單執行緒及加入 `onTrimMemory` 緩存釋放。

## [1.2.13] - 2026-11-23

### Added & Fixed (Native Python Default, Sandbox Add-on, Clean ANSI Logs, Phone-Default Detection & Upgrade Package Restore)
- **原生 Python 直譯器預設與 Pyodide 沙盒附加功能強化**：
  - 預設執行引擎改為 **Python 直譯器**（Termux／內嵌 ARM64），將 **Pyodide 瀏覽器沙盒**收斂至設定內的選用附加功能開關，避免新手誤在沙盒執行需原生擴充或子行程的腳本。
  - 為沙盒補上 `subprocess` / `os.system` 防護提示（處理 `OSError: [Errno 138] emscripten does not support processes`）、無 `wasm32` wheel 套件提示（如 `parsel`）與 `input()` 中斷（`KeyboardInterrupt`）友善回收機制。
- **終端機與匯出日誌 ANSI 跳脫碼淨化＋純淨文字模式**：
  - 新增 `AnsiStreamBuffer` 串流切分緩衝與完整 ANSI 解析／清除器（消除 `[0m`、`[38;5;...m`、`;88mO`、`91mn` 等殘留片段），並同步在 Android 原生 `droidpy_native.log` 與 `appLogger.ts` 執行潔淨化。
  - 終端機工具列與編輯器設定同步新增「純淨文字模式 (`cleanTextMode`)」切換開關。
- **腳本環境預設為手機（Android）**：
  - 移除手機／電腦環境切換設定與共用 `tmp` 目錄輔助 API，腳本執行與 `droid.device_info()` 環境偵測預設為手機（Android）環境。
- **`pipPkgs` 統計修正與消除 `Unhandled rejection: Not found`**：
  - 修正 Android `/health` 掃描套件邏輯，改讀 `.dist-info/METADATA` 與 `.egg-info/PKG-INFO` 實際 `Name:` 欄位並正規化去重，確保 `pipPkgs` 計數與實際相符；強化 `termuxFetch` 錯誤格式與可選端點 404 容錯，並記錄 rejection 堆疊詳情。
- **修復更新／重裝程式導致已安裝套件清空，並統一「日誌」與「手機」命名**：
  - 強化 `hasExistingInstall` 偵測保留原有 `usr/`，並自動將狀態與使用者安裝的 `pip`/`pkg` 清單備份至 `/sdcard/DroidPy/.droidpy_backup/`；偵測到缺少套件時於介面提供一鍵還原橫幅。
  - 所有「所有日誌／查看執行日誌」按鈕簡化為「日誌」，裝置儲存空間「本機」文案改為「手機」。

## [1.2.12] - 2026-11-22

### Added & Fixed (HH:MM:SS Timer, Single-Version Changelog, Package Uninstall, Update Accuracy, Launch-Only Auto-Update & WebView Text Copy)
- **執行耗時改為實時顯示時分秒 (`HH:MM:SS`)**：
  - 終端機執行腳本、Termux Shell 或安裝套件期間實時顯示 `00:00:00` 計時器，執行完成與日誌紀錄統一格式化為 `HH:MM:SS`。
- **程式更新日誌僅顯示當前目標／已安裝版本**：
  - `AppUpdateModal` 移除冗長多版本歷史摺疊清單；偵測到新版時僅顯示新版日誌，已為最新時僅展示目前版本 (`v1.2.12`) 日誌。
- **新增沙盒與 Termux 套件解除安裝功能**：
  - `ToolsAndPackages` 與 `TermuxIntegrationPanel` 針對非核心套件新增「解除安裝」按鈕；`pkg` Wrapper 與 `pip uninstall -y` 支援正確清理 `dpkg/status` 並保護核心直譯器與工具不被誤刪。
- **修復「套件已是最新版本仍提示更新」與「自動更新僅限開啟程式時執行」**：
  - `pyodideRuntime` 加入 PEP 440 版本比較與 Lockfile 相容上限檢查，Termux 透過 `pip list --outdated --format=json` 精準比對過期項目；移除未過期項目的更新提示。
  - 背景自動更新改以啟動當下鎖定的一次性檢查為準，開機視窗外與切換開關均不再於使用中途觸發背景更新。
- **新增「一鍵更新所有套件」統一按鈕**：
  - 一鍵整合檢查並升級 Pyodide 沙盒與 Termux 過期套件。
- **修復非編輯區與終端機長按選字複製問題**：
  - Android 原生 `WebView` 與 `MainActivity` 加入 `ClipboardManager` `copyToClipboard` 橋接與 `isLongClickable` 支援，終端機選字時自動暫停自動捲動並顯示「複製選取」按鈕。

## [1.2.11] - 2026-11-22

### Added & Fixed (Fun Snippets, Fuzzy Package Search, Auto-Update, In-App Updater & `sh` Permission Fix)
- **新增更多趣味 Python 腳本範例與分類篩選**：
  - `SNIPPET_TEMPLATES` 擴充至 18 個即點即跑範例（含駭客任務數位雨、曼德布羅碎形、康威生命遊戲、迷宮 DFS 生成與 BFS 尋路、互動 21 點撲克、AI 二分搜尋猜數字、Wordle 猜字、Hacker News 熱榜即時爬蟲、CSV 銷售統計圖、極座標愛心曲線、番茄鐘震動倒數計時器、安全密碼熵值生成器、QR Code 終端生成與本機 JSON API 測試伺服器），並於檔案總管加上 7 大分類頁籤篩選。
- **新增程式內版本檢查、APK 下載與更新日誌展示**：
  - 新增 `AppUpdateModal` 支援連線 GitHub Releases 檢查最新版本（CI 自動帶入倉庫 Slug 並支援手動設定 `owner/repo` 與代理回退），當偵測到新版本時自動展示完整更新日誌、歷史版本清單與預編譯 APK 檔案大小。
  - Android 原生 `MainActivity.kt` 與 `AndroidManifest.xml` 加入 `REQUEST_INSTALL_PACKAGES`、`FileProvider` 與 `downloadAndInstallApk()` 原生串流下載器，支援程式內顯示下載進度並直接呼叫系統套件安裝程式覆蓋升級（與固定簽名金鑰相容）。
- **新增更全熱門與冷門套件目錄、分類篩選與輸入模糊聯想**：
  - 整理 60+ 款支援行動開發的熱門與冷門 Python／Termux 套件（涵蓋「爬蟲與網路」、「科學與數據」、「圖像與影音」、「Web 與 API」、「冷門寶藏工具」如 `rich`、`faker`、`thefuzz`、`pypinyin`、`jieba`、`icecream`、`loguru`、`art`、「編譯與系統工具」），並提供 `全部 / 熱門 / 冷門` 與分類篩選。
  - 輸入套件名稱時即時顯示模糊搜尋聯想清單（支援拼字容錯、縮寫別名如 `bs4`／`pil`／`np`／`yaml` 以及 Termux APT 套件名自動提示如 `numpy` → `pkg install python-numpy`）。
- **新增已安裝套件手動與背景自動更新機制**：
  - Pyodide 沙盒與 Termux 原生環境皆支援檢查過期套件、單筆升級或一鍵全部更新（`pip install --upgrade` / `pkg upgrade -y`），並於設定與負屏工具箱提供「啟動時自動檢查並更新已安裝套件」開關。
- **修復實機編譯套件時 `make[1]: /data/data/com.termux/files/usr/bin/sh: Permission denied` 錯誤**：
  - `EmbeddedTermuxBridge.kt` `buildEnv()` 自動導出 `SHELL`、`CONFIG_SHELL` 與 `CMAKE_SH` 指向 App 私有目錄下可執行之 `usr/bin/sh`（或 `/system/bin/sh`），避免 `make` / `cmake` / `ninja` 在手機上編譯原生擴充時誤呼叫無權限的舊 Termux 路徑。

## [1.2.10] - 2026-11-22

### Fixed (`PermissionError: [Errno 13]` on Truststore SSL & `build_clib` C Compilation)
- **根治一鍵初始化時的 `pip/_vendor/truststore` `PermissionError: [Errno 13]`**：
  - `pip` / `pip3` Wrapper 改為於執行當下動態尋找可讀取之 CA 憑證（含自動複製 `pip._vendor.certifi.where()` 至可寫暫存路徑），並同步設定 `PIP_CERT` 與 `SSL_CERT_DIR`，避免同一次 `pkg install && pip install` 執行鏈中 `pip` 進入 `_create_truststore_ssl_context()` 觸發跨權限存取拒絕。
- **根治編譯 C 擴充套件（如 `Pillow` `build_clib`）時的 `error: [Errno 13] Permission denied`**：
  - `relocate_debs()` 補充修正 `usr/etc`、`usr/lib`、`usr/share`、`usr/include` 與 LLVM／Clang 工具鏈執行權限，並自動將 Python `_sysconfigdata*.py`、`Makefile` 及 `pkgconfig/*.pc` 內的 `/data/data/com.termux/files/usr` 改寫為實際私有目錄。
  - `buildEnv()` 於安裝 `clang` 後自動導出 `CC`、`CXX`、`LDSHARED`、`AR`、`RANLIB`、`CPPFLAGS`、`LDFLAGS` 與 `PKG_CONFIG_PATH`，確保原生編譯流程不再誤觸受限路徑。
- **優化 Termux 快捷套件清單**：
  - 新增 Termux 預編譯套件 `python-pillow`、`python-lxml`（對應 `pkg` 實際套件名）與純 Python `flask`，避免在無 `rustup` 目標架構支援的手機環境直接編譯 `pydantic-core` 或從源碼編譯 Pillow。

---

## [1.2.9] - 2026-11-22

### Fixed (Real-Device Execution Logs: `pip install` exit 2 & `pkg update` exit 100)
- **修復實機執行 `pip install requests` / `pip install beautifulsoup4` 回傳 `exitCode=2` 的問題**：
  - `EmbeddedTermuxBridge.kt` 與 `MainActivity.kt` 改為遞迴修復 `usr/bin`、`usr/etc`、`usr/lib`、`usr/libexec`、`usr/share` 內所有指向 `/data/data/com.termux/files/usr` 的符號連結（涵蓋 `etc/tls/cert.pem` 與 CA 憑證目錄）。
  - 新增 `resolveCaBundleFile()` 檢查：僅在實際存在的 CA 憑證檔可讀取時才注入 `PIP_CERT`、`REQUESTS_CA_BUNDLE`、`SSL_CERT_FILE`、`CURL_CA_BUNDLE`，避免因預設 `etc/tls/cert.pem` 尚未安裝或為無效連結導致 `pip` 拋出 `OSError`（`UNKNOWN_ERROR=2`）立即退出；並於 `pip` Wrapper 補上不存在憑證時自動 `unset` 與 `ensurepip` 檢查、指定獨立 `PIP_CACHE_DIR`／`XDG_CACHE_HOME`。
- **修復實機執行 `pkg update` 回傳 `exitCode=100` 的問題**：
  - `ensurePrefixWrappers()` 自動將 `etc/apt/sources.list` 與 `etc/apt/sources.list.d/*.list` 補齊 `[trusted=yes]` 並重寫 `bin/apt-key` 舊路徑，同時於 `apt.conf`／`APT_OPTS` 加入 `Acquire::AllowDowngradeToInsecureRepositories=true` 與 `Dir::Bin::apt-key`／`Dir::Bin::gpg`，消除重定位後金鑰驗證失敗導致 `apt-get update` 回傳 100 的錯誤。
- **強化失敗日誌詳情與 `chart_demo.py` 引擎提示**：
  - `EmbeddedTermuxBridge.kt` 與 `App.tsx` 於 `pkg`／`pip`／Shell 非 0 結束碼時自動擷取並保存最後輸出內容至「程式執行所有日誌」與 `droidpy_native.log`，方便一鍵診斷。
  - `chart_demo.py` 在未安裝 `matplotlib` 的 Termux 環境改為輸出友善提示，引導切換沙盒或安裝套件。

---

## [1.2.8] - 2026-11-21

### Fixed & Improved (Persistence, APT Prefix, Script Feedback, Phone/Tablet UX & Historical Releases)
- **修復退出程式重新進入後套件／Termux Python 恢復預設的問題**：
  - 修正 `MainActivity.kt` 原本僅檢查 `bin/sh` 是否存在而誤判損壞符號連結並刪除整個 `usr/` 的 Bug：改以 `.droidpy_bootstrap_ok` 與真實執行檔（`python`/`python3`/`apt-get`/`dash`/`bash`）判斷是否已完成解壓；重開 App 時僅執行 `repairTermuxRuntime(usrDir)` 修復 `sh`、`python`/`python3` 與路徑符號連結，絕不覆蓋或清空已安裝套件。
  - `EmbeddedTermuxBridge.kt` 安裝 `.deb` 套件時同步寫入 `var/lib/dpkg/status` 套件紀錄，並於 `/health` 回傳真實 `installedPipPackages` 與 `installedPkgPackages`，重新進入 App 後仍可正確辨識已安裝環境。
  - 硬體返回鍵雙擊退出改為等待 `droidpy-flush-state` 狀態刷寫回呼完成（附超時保護）再 `finish()`；Pyodide 沙盒已安裝套件亦持久化保存並於重啟時自動恢復。
- **修復 `/data/data/com.termux/files/usr/etc/apt/apt.conf.d/ - DirectoryExists (13: Permission denied)` 問題**：
  - `EmbeddedTermuxBridge.kt` 的 `ensurePrefixWrappers()` 改為無條件強制寫入完整 `etc/apt/apt.conf`（包含 `Dir`、`Dir::State`、`Dir::Cache`、`Dir::Etc`、`Dir::Etc::parts`、`Dir::Etc::main`、`Dir::Etc::preferences*`、`Dir::Etc::source*`、`Dir::Etc::Trusted*`、`Dir::Log` 與 `Dir::Bin::*`），並覆寫來源設定與 `apt.conf.d/*` 內殘留的硬編碼路徑、以 `apt-get -c "$APT_CONFIG"` 啟動，徹底根除權限拒絕警告。
- **修復執行 `utils.py` 沒有下一步動作／無回饋問題**：
  - 為內建 `utils.py` 加入 `if __name__ == "__main__":` 獨立測試進入點，保留 `from utils import format_device_report` 匯入相容性，同時支援對既有工作區舊版 `utils.py` 自動升級。
  - 終端機於任何檔案正常執行結束後皆顯示明確完成提示（含耗時與「無標準輸出」輔助說明），不再只停留於「正在執行」。
- **適配手機／平板／桌面操作差異並將低頻功能轉移至負屏（Negative Screen）**：
  - 新增 `useDeviceLayout` 三階段自適應介面與左滑側欄「負屏工具箱」(`NegativeScreenDrawer`)：手機版頂欄極簡化（左上負屏鈕 + 執行按鈕）與底部 4 分頁專注工作區；平板版提供頂部檔案分頁、`雙欄分屏 / 純編輯` 切換與橫直向自動佈局；低頻的 Termux 連線調校、套件管理、儲存授權與 APK 匯出皆收納於負屏工具箱，支援左側邊緣右滑喚出與硬體返回鍵優先關閉。
- **版本發布保留所有歷史版本 APK**：
  - 更新 `.github/workflows/droidpy.yml` 與匯出 CI 範本：每次建置採用獨立版號 Artifact（保留 90 天）、GitHub Release 永不 `--clobber` 覆蓋既有 `.apk` 資產，並於 Release 頁面自動附上歷史版本 APK 下載索引。
- **加入「程式執行所有日誌」檢視與匯出面板**：
  - 新增 `appLogger.ts` 全域日誌收集器（自動持久化於 `localStorage`）與 `AppExecutionLogModal` 日誌面板，完整記錄 App 啟動、檔案同步、Pyodide／Termux 初始化與執行、套件安裝及未捕捉錯誤。
  - Android 原生 `EmbeddedTermuxBridge.kt` 與 `MainActivity.kt` 同步將啟動與橋接事件寫入 `droidpy_native.log`，並開放 `GET /logs`（整合 `droidpy_native.log` 與 `logcat`）與 `POST /logs/clear` 供手機端一鍵檢視、搜尋、複製與匯出 `.log`。

---

## [1.2.7] - 2026-11-21

### Fixed & Improved (Consistent APK Signing & Seamless In-Place Upgrades)
- **確保以後所有 GitHub Actions 打包的 APK 簽名永久一致**：
  - 預置固定 30 年效期（2026–2056）的標準簽名金鑰 `signing/droidpy-debug.p12`（SHA-256 指紋：`29:C5:49:F0:2A:B1:78:1D:42:D9:4A:6D:80:53:0E:C8:EF:86:67:0C:82:60:5F:92:55:FD:D9:5D:5D:54:5E:BA`），並同步內嵌至匯出專案 `android/app/droidpy-debug.p12`，徹底解決雲端 Runner 每次重產生隨機 debug keystore 導致無法覆蓋升級安裝的問題。
  - 更新 `android/app/build.gradle.kts` 明確綁定 `signingConfigs.droidpy` 至 `debug` 與 `release` 建置類型，並從環境變數自動讀取與版本號對應的遞增 `versionCode`（如 `v1.2.7` → `10207`）與 `versionName`。
  - `.github/workflows/droidpy.yml` 與匯出的 `.github/workflows/build-apk.yml` 亦支援選填 GitHub Repository Secrets（`DROIDPY_KEYSTORE_BASE64`、`DROIDPY_STORE_PASSWORD`、`DROIDPY_KEY_ALIAS`、`DROIDPY_KEY_PASSWORD`）切換為個人正式發佈憑證，並在建置日誌輸出 `apksigner verify --print-certs` 驗證指紋。

---

## [1.2.6] - 2026-11-21

### Fixed (Storage Permissions UI & Embedded Termux `pkg` Initialization)
- **修復「授權資料夾」、「授權本機資料夾」與「更新容量」三個按鈕點擊無響應問題**：
  - **更新容量**：`EmbeddedTermuxBridge.kt` 的 `GET /sdcard/status` 新增 `StatFs` 讀取裝置真實內部儲存空間（`totalBytes` / `usedBytes` / `freeBytes`）；前端 `ToolsAndPackages.tsx` 加入整理旋轉動畫與即時通知 Toast，顯示實際裝置／快取容量。
  - **授權本機資料夾／授權資料夾**：移除 `!supportsDirectoryAccess()` 時按鈕的 `disabled` 禁用狀態。在 Android APK 模式下直接串接 `DroidPyNative.requestStoragePermission()` 與 `/sdcard/status` 授權檢查並顯示明確通知；在一般瀏覽器／iFrame 環境遇到不支援或被封鎖的 `showDirectoryPicker` 時，自動退回 `<input webkitdirectory>` 原生資料夾選擇器載入專案檔案，並於檔案總管常駐可點擊狀態。
- **修復獨立 APK「一鍵初始化 Python + 爬蟲環境」卡住與報錯問題**：
  - 修正 `MainActivity.kt` Bootstrap 解壓及 `relocate_debs()` 遇到絕對路徑 `/data/data/com.termux/files/usr/...` 符號連結失效問題（修復 `etc/apt/trusted.gpg.d/*.gpg` 造成 `apt-get update` 顯示 `Ign: InRelease` 的異常）。
  - 補強 `pkg` 包裝腳本的 `APT_CONFIG` 與 `APT_OPTS`（補上 `Dir::Etc::parts`、`Dir::Etc::main`、`Dir::Etc::preferences`、`Dir::Log`、`APT::Sandbox::User=root`），消除 `W: Unable to read /data/data/com.termux/files/usr/etc/apt/apt.conf.d/ - DirectoryExists (13: Permission denied)` 警告。
  - 將 `relocate_debs()` 改用 GNU `tar --overwrite` 管線精準搬移 `.deb` 內容、印出逐個套件解壓進度、自動建立 `python` / `python3`（支援 Python 3.14）與 `pip` 符號連結並修正可執行權限與 `/health` 偵測。
  - 一鍵初始化改用 Termux 預編譯 `python-lxml`（搭配 `python-pip`、`libxml2`、`libxslt`、`clang` 與 `pip install --no-cache-dir requests beautifulsoup4 httpx`），避免在手機端從原始碼編譯 `lxml` 失敗，並於初始化 `finally` 階段強制刷新 `checkTermuxHealth`，確保黃色提醒橫幅即時消退。

---

## [1.2.5] - 2026-11-21

### Added (Android APK Icon & Navigation Polish)
- **為 Android APK 加上專屬應用程式圖徽（Logo）**：
  - 使用 DroidPy 內建的翡翠綠＋琥珀橘交錯蛇形圖示產生 Android Adaptive Icon 向量資源（`drawable/ic_launcher_background.xml`、`drawable/ic_launcher_foreground.xml`、`mipmap-anydpi-v26/ic_launcher*.xml`）與全密度 `mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}` PNG 回退圖檔，並於 `AndroidManifest.xml` 指定 `android:icon="@mipmap/ic_launcher"` 與 `android:roundIcon="@mipmap/ic_launcher_round"`。
- **加入「返回兩次退出 App」防誤觸保護**：
  - 更新 `MainActivity.kt` 的 `OnBackPressedCallback`：先優先處理內嵌爬蟲瀏覽器關閉與網頁返回；回到 IDE 主畫面時首次按下返回鍵（或側滑返回）彈出「再按一次返回鍵退出 DroidPy」提示，於 2 秒內再次返回才會立即刷寫儲存狀態並退出程式。

---

## [1.2.4] - 2026-11-21

### Fixed (Real-Device Android APK Testing)
- **修復「app 退出重開資料保留」問題**：
  - `MainActivity.kt` 啟用 WebView `databaseEnabled`，新增 `DroidPyNative.readPersistedState()` / `writePersistedState()` 以原子 `.tmp` + `renameTo` 將工作區所有檔案、作用中檔案 ID、字體與主題設定、語言、執行引擎及爬蟲 Cookie 備份至 App 私有檔案 `filesDir/droidpy_ide_state.json`，並在 `onPause()` / `visibilitychange` / `pagehide` 即時寫入，確保滑掉 App 或系統回收後重開 100% 保留資料。
- **修復「拿到儲存權限卻沒有真正存取與管理內部儲存空間」問題**：
  - `AndroidManifest.xml` 補上 `android:requestLegacyExternalStorage="true"`，並修正 `MainActivity.kt` 在 Android 11+ 同時檢查 `Environment.isExternalStorageManager()` 與執行期 `WRITE_EXTERNAL_STORAGE` 權限。
  - `EmbeddedTermuxBridge.kt` 新增原生 `/sdcard/status`、`/sdcard/list`、`/sdcard/read`、`/sdcard/write`、`/sdcard/mkdir`、`/sdcard/delete` API，並在工作區建立 `./sdcard -> /storage/emulated/0` 符號連結。
  - 前端新增 `InternalStoragePanel` 與檔案總管 `/sdcard` 快捷列，支援在手機上直接瀏覽 `/storage/emulated/0`、建立資料夾、開啟 `/sdcard` 檔案編輯、一鍵寫入或備份整個專案至 `/sdcard/DroidPy`，並在系統設定授權返回後自動重新偵測權限狀態。
- **修復「點擊執行只顯示正在執行 main.py、沒有下一步動作」問題**：
  - `EmbeddedTermuxBridge.kt` 補齊 `PYTHONHOME=$usrDir` 與 `PYTHONPATH="$HOME/.droidpy_lib:$workspaceDir"`（修正重定位 Termux Python 3.12 找不到標準庫 `encodings` 而無輸出退出的問題），並於 `$HOME/.droidpy_lib/droid.py` 實作完整原生 `droid` 模組（`vibrate`、`toast`、`device_info`、`storage_info`、`sdcard_path`、`battery`）轉接 `/droid-action`，讓內建 `main.py` 在 APK 原生 Termux 模式不再因 `ModuleNotFoundError: No module named 'droid'` 失敗。
  - 新增 `python` / `python3` 存在檢查：若尚未完成首次「一鍵初始化 Python」，於終端機即時提示並提供一鍵初始化按鈕，不再靜默卡住。
- **修復「點擊執行變成停止執行後無法恢復執行按鈕」問題**：
  - `EmbeddedTermuxBridge.kt` 的 `POST /stop` 改以遍歷 `/proc` 子樹 PID 強制終止整棵程序樹並關閉 I/O 串流，立即解除串流讀取阻塞並送出 `done` 結束事件。
  - 前端 `termuxBridge.ts` 加入 `AbortController` (`abortActiveTermuxStream()`) 與 `sawDone` 保護，`App.tsx` 的 `handleStopTermux()` 立即中斷 HTTP 串流並以 `finally { setTermuxRunning(false); }` 確保按鈕永遠恢復為「執行程式」。

---

## [1.2.3] - 2026-11-21

### Fixed (Android APK, Runtime, Crawler & Mobile IDE)
- **修復獨立 APK 執行含中文字元腳本時永久卡死 Bug**：`EmbeddedTermuxBridge.kt` 的 HTTP Server 原本以 `BufferedReader` 字元數比對位元組長度 `Content-Length`，導致任何包含中文註解或字串的程式碼在 `POST /run-stream` 時永遠等待剩餘字元而卡住；現已改為 `BufferedInputStream` 精確位元組長度讀取與 UTF-8 解碼。
- **修復 APK 與 Termux 終端機中文串流亂碼 Bug**：將 `EmbeddedTermuxBridge.kt` 與 `droidpy_bridge.py` 串流輸出改為 UTF-8 增量字元解碼（`InputStreamReader` / `codecs.getincrementaldecoder`），避免多位元組中文字在讀取邊界被切斷顯示 ``。
- **修復 APK WebView 外部連結劫持 IDE 與下載檔名跳脫 Bug**：`MainActivity.kt` 改以精確比對 `appOriginHost` 區分站內與外部 `https://` 連結（點擊外部網站時由系統瀏覽器開啟，不再覆蓋整個 DroidPy 介面），並對 `setDownloadListener` 注入 JS 參數使用 `JSONObject.quote` 安全跳脫，同時強化 Bootstrap `bin/sh` 完整性檢查與 `pkg` 倉庫金鑰信任參數。
- **修復爬蟲瀏覽器匯入 / 同步 Bug**：修正 `parseRawCrawlerInput` 無法正確解析 DroidPy 自匯出 `cookies.json` 物件格式（先前會誤將 `url`、`headers`、`cookies` 當作 Cookie 名稱），改善 DevTools `cURL` 解析容錯，並確保 `CrawlerBrowserPanel` 在手機切換分頁或 APK 原生擷取 Cookie 後保留網址與探測結果不重置。
- **修復編輯器與 Python REPL Bug**：
  - 為桌面與手機版 `CodeEditor` 加上檔案 `key`，修復切換檔案後按下「復原 (Undo)」誤將上一個檔案內容覆蓋到新檔案的問題，並於 Pyodide 載入完成後立即觸發語法檢查。
  - 修復互動式 REPL 輸入 `input()` 時未使用非同步提示、以及從 Termux 切換回 Pyodide 時核心未自動初始化、狀態標籤將未就緒顯示為「核心就緒」的問題。
  - 為檔案建立／重新命名／匯入加上路徑分隔符消毒與 512 KB 上傳大小防護，避免破壞沙盒路徑或超出儲存空間上限。

---

## [1.2.2] - 2026-11-21

### Fixed (GitHub Release Automation)
- **修復推送分支時「建立 GitHub Release」被跳過問題**：更新 `.github/workflows/droidpy.yml`，於一般 Push 至 `main`/`master` 或手動觸發（未填 `release_tag`）時自動讀取 `CHANGELOG.md` 最新版本號（如 `v1.2.2`），直接建立或覆寫更新對應的 GitHub Release 與 APK 附件，不再跳過第三階段工作。

---

## [1.2.1] - 2026-11-21

### Fixed (GitHub Actions CI & Auto Android APK Build)
- **修復 GitHub Actions 工作流程被跳過問題**：整合並更新 `.github/workflows/droidpy.yml`，移除依賴不存在 `buildozer.spec` 的跳過條件；新增 `scripts/prepare-android.ts` 於雲端 Runner 自動由 `src/services/androidApkBuilder.ts` 產生完整 `android/` Gradle + Kotlin + 內嵌 Termux 專案，即使倉庫尚未手動匯出 `android/` 資料夾也能於每次 Push / 手動觸發執行測試、網頁建置與 ARM64 APK 打包（不再被跳過）。
- **修復 `npm ci` `ERESOLVE` 相依性衝突**：針對 `vite@8` 與 `esbuild@0.25` 的 `peerOptional` 版本差異，於 CI 與匯出流程加入 `--legacy-peer-deps` 安全退回。
- **支援手動觸發發布 Release**：`droidpy.yml` 新增 `workflow_dispatch` 的 `release_tag` 選填輸入，除推送 `v*` 標籤自動發布外，也可直接從 GitHub Actions 手動觸發打包並建立 Release。

---

## [1.2.0] - 2026-11-21

### Fixed (Mobile Execution & Standalone APK)
- **修復內嵌 APK `pkg` / `pip` 跨包名路徑相容性**：在 `EmbeddedTermuxBridge.kt` 加入 `$HOME/.droidpy_bin` 前綴轉接層（`pkg` / `pip` / `pip3` Wrapper），自動將 Termux Bootstrap 套件（`python`、`clang`、`libxml2`、`libxslt`、`ffmpeg`）安全重定位至獨立 App 的 `$PREFIX` 私有目錄並修正 Script Shebang 與 SSL 憑證變數（`SSL_CERT_FILE` / `PIP_CERT` / `REQUESTS_CA_BUNDLE`）。
- **修復 Kotlin 編譯模板字面量跳脫錯誤**：修正 `EmbeddedTermuxBridge.kt` `/run-stream` 中 `\$PREFIX` 未解析參考問題，並改以 `exec python -u` 啟動，確保點擊「停止」時可立即終止 Python 子程序、不留孤兒進程。
- **修復手機虛擬鍵盤與底部導覽列遮擋問題**：於 `index.html` 加入 `interactive-widget=resizes-content`，並在 `MainActivity.kt` 啟用 `windowSoftInputMode="adjustResize"`、將手機版底部導覽列改為彈性排版（非懸浮覆蓋），確保開啟鍵盤時符號列與 REPL 輸入框始終完整可見。
- **修復 Pyodide 行動端執行細節**：
  - 修復首次執行 `matplotlib` 腳本時 `plt.show()` 尚未被攔截導致首跑不出圖的問題。
  - 優雅處理 `sys.exit()`，避免正常結束碼 `0` 被誤報為紅色錯誤訊息。
  - 支援在互動式 REPL 直接執行頂層 `await` 表達式（如 `await droid.battery()`）。
  - 離線開啟 APK（已啟用內嵌 Termux 引擎）時不於背景強行拉取 Pyodide CDN 而顯示紅字連線錯誤。
- **修復 Termux 橋接多套件安裝解析**：`droidpy_bridge.py` 改用 `shlex.split` 拆分套件名稱，修復從 `requirements.txt` 一次安裝多個套件時失敗的問題。
- **修復 Android WebView 外部連結處理**：`MainActivity.kt` 攔截 `termux://`、`intent://` 等外部協定並轉交系統開啟，避免產生 `ERR_UNKNOWN_URL_SCHEME`。

### Fixed (GitHub Actions APK Build & Release)
- **修復 `.github/workflows/build-apk.yml` 標籤發佈失效問題**：於 `on.push` 補齊 `tags: [ 'v*' ]`，確保推送版本標籤（如 `v1.2.0`）時能正確觸發自動打包與 GitHub Releases 發佈。
- **指定相容 Gradle 版本與彈性依賴安裝**：於 `gradle/actions/setup-gradle@v4` 明確指定 `gradle-version: '8.7'`（符合 AGP 8.5.2 需求），並將 `npm ci` 改為自動判斷 `package-lock.json` 存在與否後退回 `npm install`，相容使用 `bun.lock` 的倉庫。
- **自動帶入更新日誌**：GitHub Release 步驟自動附加 `CHANGELOG.md` 作為發佈說明並啟用自動產出 Release Notes。

---

## [1.1.0] - 2026-11-20

### Added & Fixed
- **新增爬蟲瀏覽器與 Cookie 工作台（Crawler Browser）**：整合網頁預覽、Termux 原生 `/probe-url` 無 CORS 探測、cURL / HTTP Header / Netscape `cookies.txt` / JSON / 手機 Chrome 書籤小工具匯入，以及原生 APK `WebView` + `CookieManager`（可讀含 `HttpOnly` Cookie）自動同步 `cookies.json`。
- **新增多語系應用內教學說明（Help & Tutorial）**：內建繁體中文 / 簡體中文 / English / 日本語 4 語互動教學與一鍵載入範例腳本。
- **修復獨立 APK 離線資源載入**：透過 `EmbeddedTermuxBridge.kt` 在 `http://127.0.0.1:8765/` 供應 `assets/www/` 靜態資產，解決 `file://` 下的 ES Module CORS 與 `/assets/` 404 白畫面。
- **修復 Android WebView 檔案下載檔名**：透過 `downloadBlob` / `DroidPyNative.saveBase64File` 將匯出之 ZIP、腳本與圖表 PNG 以原始檔名寫入系統 Downloads 資料夾。
- **擴充本機資料夾同步支援**：支援同步 `.py`、`.json`、`.csv`、`.txt`、`.md`、`requirements.txt` 等所有工作區純文字檔案。

---

## [1.0.0] - 2026-11-18

### Initial Release
- **雙引擎行動 Python 3.12 IDE**：結合 Pyodide WebAssembly 離線沙盒（支援 `numpy`、`pandas`、`matplotlib`、`import droid` 硬體橋接）與 Termux PTY 原生串流橋接。
- **Android 觸控優化**：CodeMirror 6 語法高亮與即時檢查、可收合觸控快捷符號列、10 套主題配色與 4 國介面語言。
- **GitHub 獨立 APK 自動打包器**：一鍵匯出包含 `.github/workflows/build-apk.yml`、Kotlin `WebView` 與內嵌 Termux Bootstrap 的 Android 專案。
