# GitHub Pages 公開手順

このMVPの公開用ファイルは `docs/index.html` です。

## 初回だけ

1. GitHubで新しいリポジトリを作る
2. このフォルダで以下を実行する

```bash
git init
git add .
git commit -m "Initial MVP"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/YOUR_REPOSITORY.git
git push -u origin main
```

## GitHub Pages設定

1. GitHubのリポジトリページを開く
2. `Settings` → `Pages`
3. `Build and deployment` の `Source` を `Deploy from a branch`
4. `Branch` を `main`、フォルダを `/docs` にする
5. `Save`

数分後にURLが発行されます。

## 更新するとき

ブラウザ版を更新したら、以下で公開用ファイルを更新します。

```powershell
Copy-Item -LiteralPath web-preview\index.html -Destination docs\index.html -Force
git add .
git commit -m "Update app"
git push
```

## 注意

データは各ブラウザの `localStorage` に保存されます。URLを共有しても、相手には自分の端末内データだけが見えます。
