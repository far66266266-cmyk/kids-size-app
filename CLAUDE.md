# Claude Code Handoff: これ着れる？

このリポジトリは、子供服・子供靴のサイズ記録アプリ「これ着れる？」のMVPです。  
現在は Expo + React Native + TypeScript のアプリ本体に加えて、GitHub Pagesで公開するための静的HTML版もあります。

## まず読むこと

- 公開中・ユーザー確認対象の本命は `docs/index.html` です。
- 開発しやすい静的プレビュー元は `web-preview/index.html` です。
- Expo/React Native版は `App.tsx` と `src/` にあります。
- 静的HTML版を直したら、必ず `web-preview/index.html` から `docs/index.html` にコピーしてください。

```powershell
Copy-Item -LiteralPath web-preview\index.html -Destination docs\index.html -Force
```

## ユーザーの現在の期待

ユーザーは非エンジニア寄りです。説明はかなり噛み砕いて、必要なPowerShellコマンドは「1行ずつそのまま打つ」形で渡してください。

直近の目的は、GitHub Pagesでスマホから見られるWeb MVPを少しずつ改善することです。  
本格的な共有・ログイン・クラウド同期はまだ後回しです。

## アプリの現状

できること:

- 子供を追加
- 子供の名前・生年月日・性別を編集
- 身長・体重を記録
- 記録日は「今日」または「日付を選ぶ」
- 下着・トップス・ボトムス・靴下・靴を記録
- サイズはプルダウン
  - 服: 70-170cm、5cm刻み
  - 靴: 12.0-25.0cm、0.5cm刻み
  - 靴下: 7-24
- 着用感を記録
  - 着れない
  - 小さい
  - ぴったり
  - 大きい
  - ぶかぶか
- ブランドを追加
- 情報追加時に、登録ブランドと過去に記録したブランドから選択
- トップに最新の身長・体重、服/靴の記録を表示
- サイズは昇順表示
- 同サイズは `ぴったり（UNIQLO）、大きい（GU）` のようにまとめて表示
- 記録を見る画面で身長・体重の折れ線グラフを表示
- バックアップを書き出す/読み込む

まだやっていないこと:

- ログイン
- クラウド同期
- 家族共有
- Amazon/楽天/メルカリ連携
- OCR
- AI判定

## データ保存

静的HTML版はブラウザの `localStorage` に保存します。  
つまり、同じURLでもPCとスマホでデータは共有されません。Cookieやサイトデータ削除で消える可能性があります。

localStorage keys:

- `korekireru.web.children.v3`
- `korekireru.web.brands.v1`

バックアップはJSONファイルとしてダウンロードします。読み込み時は、現在のブラウザ内データをバックアップ内容で置き換えます。

## 主要ファイル

- `web-preview/index.html`
  - 静的Web版の開発元
  - GitHub Pages版に反映する前にここを編集する
- `docs/index.html`
  - GitHub Pagesで配信されるファイル
  - `web-preview/index.html` からコピーして同期する
- `App.tsx`
  - Expo/React Native版
  - なるべくWeb版と文言・挙動を合わせる
- `src/types.ts`
  - データ型
- `src/storage.ts`
  - AsyncStorage保存処理
- `src/utils/fitJudge.ts`
  - 当初のサイズ判定ロジック
  - 現在のMVPは記録機能中心なので、UIでは主役ではない
- `GITHUB_PAGES.md`
  - GitHub Pages公開手順

## 実行コマンド

Expo:

```powershell
npm.cmd start
```

静的Webプレビュー:

```powershell
npm.cmd run preview:web
```

公開用 `docs` プレビュー:

```powershell
npm.cmd run preview:pages
```

型チェック:

```powershell
npm.cmd run typecheck
```

HTML内スクリプトの簡易構文確認:

```powershell
node -e "const fs=require('fs'); for (const f of ['web-preview/index.html','docs/index.html']) { const s=fs.readFileSync(f,'utf8'); new Function(s.match(/<script>([\s\S]*)<\/script>/)[1]); console.log(f, 'ok'); }"
```

## Gitの注意

通常の `.git` は所有者・権限問題で使いづらくなっています。  
このプロジェクトでは回避用に `.push-git/.git` を使ってコミット・pushしています。

状態確認:

```powershell
git --git-dir=".push-git\.git" --work-tree="." status --short --branch
```

コミット:

```powershell
git --git-dir=".push-git\.git" --work-tree="." add .
git --git-dir=".push-git\.git" --work-tree="." commit -m "Message"
```

GitHubへpush:

```powershell
git --git-dir=".push-git\.git" --work-tree="." push
```

リモート:

```text
https://github.com/far66266266-cmyk/kids-size-app.git
```

GitHub Pages:

- branch: `main`
- folder: `/docs`
- URL想定: `https://far66266266-cmyk.github.io/kids-size-app/`

## 直近の未pushに注意

2026-07-03時点で、`.push-git` 側は `origin/main` より進んでいる可能性があります。  
Claude Codeに渡ったら、まず以下を確認してください。

```powershell
git --git-dir=".push-git\.git" --work-tree="." status --short --branch
```

`ahead` と出ていれば、ユーザーに push してもらうか、Claude Code側でネットワーク認証が使えるなら push してください。

## 編集方針

- ユーザーはスマホで触る前提です。小さい入力欄や横にはみ出るUIは避けてください。
- まず静的HTML版を直すと、GitHub Pagesにすぐ反映できます。
- Expo版にも同じ改善を入れられるなら入れてください。ただし、短期の確認対象はWeb版です。
- データモデル変更をするときは、既存localStorageデータを壊さないようにしてください。
- `children.v3` の既存データを読める状態を保ってください。
- 削除や全置換系の機能は確認ダイアログを挟んでください。

## 次にやるとよさそうなこと

優先度高め:

- バックアップ読み込み前に「現在のデータも念のため書き出す」導線を出す
- 記録削除機能
- ブランド削除・編集機能
- 子供ごと/カテゴリごとの記録編集
- スマホ表示の余白とボタン密度の調整

中長期:

- Supabase/Firebaseなどでクラウド同期
- 家族共有
- Expoアプリとしてビルド
- CSV/JSONのより丁寧なエクスポート

