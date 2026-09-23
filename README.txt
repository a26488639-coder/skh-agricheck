SKH AgriCheck V1.1 Mobile｜案件首頁版
黃上科建築師事務所

啟動：
1. Windows 可雙擊 START-SKH-AGRI-MOBILE.cmd。
2. 手機正式使用建議部署至 HTTPS 網址，再「加入主畫面／安裝 App」。

V1.1 主要更新：
- 新增 App 案件首頁：新增案件、開啟案件、繼續目前案件、最近案件。
- SKH design 公司 Logo 整合至首頁、標題列、案件管理與 PWA 圖示。
- 手機底部導覽改為：首頁／輸入／圖面／檢討／案件。
- 新增目前案件自動草稿暫存；正式儲存仍由「儲存案件」管理。
- 最近 3 筆已儲存案件可從首頁直接開啟。
- 保留 V1.0.1 的畸形地順形農舍、自動最大化、斜基地、40%配置、曬場、圍牆／擋土牆精算。
- PWA 離線快取已更新為 V1.1。

案件資料：
- 正式案件：儲存在此裝置的瀏覽器 localStorage，可匯出 JSON 備份。
- 工作草稿：在輸入或修改時自動暫存，回到首頁可按「繼續目前案件」。
- 清除瀏覽器網站資料可能會刪除本機案件，重要案件請匯出 JSON。

V1.1.1 Deploy 補充：
- 已加入 GitHub Pages 用 .nojekyll。
- PWA cache 版本更新為 v1.1.1，避免手機持續讀取舊版。
- 補上 iOS / Android standalone meta。
- 詳細部署與手機測試請看 DEPLOY-GITHUB-PAGES.txt。
