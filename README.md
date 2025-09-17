# 完全自動版導購站（不用 Google Sheets）

> 一次上傳，從此自動：GitHub Actions 會每天根據 `data/sources.csv` 自動產生 `data/products.json`，前端自動顯示最新商品。

## 你要做的唯一步驟
- 把整個資料夾直接上傳到你的 GitHub Pages repo（或任何靜態主機）。完成。

（如需自訂商品，只要編輯 `data/sources.csv`，其他全部自動）

## 檔案說明
- `index.html` + `assets/`：前端導購站（讀取 `data/products.json`）。
- `data/sources.csv`：**資料來源清單**（你只維護這個）。
- `data/products.json`：由 GitHub Actions 自動產生（不要手改）。
- `.github/workflows/update.yml`：每日排程（可在 Actions 手動執行）。
- `scripts/update_products.mjs`：更新腳本（抓取 OG 標題/圖片，合併欄位）。

## 時程
- 預設在每日 **02:18 UTC（台灣約 10:18）** 自動執行；你也可以到 **Actions → Run workflow** 立即觸發。

## 欄位（sources.csv）
```
url,affiliate_url,title,price,rating,category,brand,tags,image,note,active
```

> 建置日期：2025-09-16
