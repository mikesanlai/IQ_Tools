# Camera Lab 影像品質測試

以瀏覽器開啟 `index.html`，使用 `images/` 中的範例照片或自行載入相片，測試七項影像品質指標。影像像素只在本機瀏覽器中計算。

## 啟動

在此資料夾執行：

```powershell
python -m http.server 8765
```

開啟 `http://localhost:8765/`。使用本機 HTTP 伺服器可確保瀏覽器允許讀取範例圖片的像素。直接以 `file://` 開啟時，頁面會等待使用者按「開啟照片」選取影像，不會自動載入內建範例；這是為了避免瀏覽器的本機檔案安全限制阻止像素讀取。

## 測試項目

| 項目 | 圖卡 | 計算內容 |
| --- | --- | --- |
| Resolution | ISO 12233 | 選取單一斜邊 ROI，估算 MTF50 和 LW/PH |
| Color Reproduction | 24 色卡 | 24 色塊與 ColorChecker Classic 參考 sRGB 的平均 ΔE*ab (CIE76) |
| White Balance | 24 色卡 | 底排四個中間灰塊的 RGB 不平衡、偏色方向與 CIE 1931 xy 色度座標 |
| Gray Scale | 24 色卡 | 底排六灰塊的 L* 排序與間距 |
| S/N Ratio | 24 色卡 | 單張照片四個灰塊的空間雜訊估計 |
| Brightness Uniformity | 白板 | 九點最低亮度與中心亮度的比值 |
| Distortion | 棋盤格 | 自動偵測角點，估算水平與垂直格線彎曲率 |

色卡測試請框選完整的 6 × 4 色塊矩陣，不含外框。畸變測試按「開始分析」即可自動抓取角點；若有背景干擾，可拖曳框選棋盤格範圍後重測。分析完成後可匯出 JSON。

## 參考值與限制

Color Reproduction 使用 [X-Rite ColorChecker Classic 舊版 sRGB 參考表](https://xritephoto.com/documents/literature/en/ColorData-1p_EN.pdf)，以 D65 白點將影像與參考值轉為 CIELAB 後計算 CIE76 色差。分析結果依色卡順序列出 24 個色塊的量測色、參考色、sRGB 色碼及逐塊 ΔE；匯出的 JSON 另包含各色塊量測 RGB。ColorChecker 後續批次的配方曾變更；光源、曝光、色彩描述檔、色卡版本與定位誤差都會影響數值。

S/N Ratio 是單張照片的**空間雜訊估計**，不是多張照片的 temporal SNR。Distortion 的自動角點與格線彎曲結果是**畸變代理指標**，不是經鏡頭模型校正的標準畸變率。這些結果供快速比較與除錯，正式測試需要控制照明、拍攝幾何與標準流程。
