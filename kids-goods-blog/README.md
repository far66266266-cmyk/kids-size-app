# これ買ってよかった！（子供服・育児グッズのアフィリエイトブログ）

子供服・育児グッズの本音レビューを載せて、楽天アフィリエイトやAmazonアソシエイトで収益化を目指すブログです。
GitHub Pagesで公開する静的サイトなので、サーバー代は0円です。

## サイトの場所

- 公開用ファイルはぜんぶ `docs/` フォルダの中にあります
- GitHub Pages の設定: branch `main` / folder `/docs`
- 公開URL想定: `https://far66266266-cmyk.github.io/kids-goods-blog/`

## ファイル構成

- `docs/index.html` … トップページ（記事一覧）
- `docs/articles/kids-clothes-size.html` … サンプル記事1（子供服のサイズ選び）
- `docs/articles/first-shoes.html` … サンプル記事2（ファーストシューズ）
- `docs/articles/template.html` … 新しい記事を書くときのテンプレート
- `docs/privacy.html` … プライバシーポリシー・免責事項（アフィリエイト審査に必要）
- `docs/css/style.css` … サイト全体のデザイン

## 収益化までにやること（順番どおりに）

1. **GitHub Pagesを有効にする**
   - GitHubのこのリポジトリ → Settings → Pages
   - Branch: `main`、Folder: `/docs` を選んで Save
   - 数分待つと上記URLでサイトが見られます

2. **アフィリエイトに登録する（無料）**
   - 楽天アフィリエイト: https://affiliate.rakuten.co.jp/ （楽天IDがあればすぐ使えて審査がゆるい。最初はここがおすすめ）
   - Amazonアソシエイト: https://affiliate.amazon.co.jp/ （審査あり。サイト公開後に申請）
   - A8.net: https://www.a8.net/ （いろんな会社の広告を扱える大手ASP）

3. **記事のリンクを差し替える**
   - 各記事の `<!-- ▼▼▼ ここにアフィリエイトリンクを貼る -->` の部分を探す
   - `href="#"` の `#` を、アフィリエイト管理画面で作った商品リンクのURLに置き換える

4. **記事を増やす**
   - `docs/articles/template.html` をコピーして新しいファイル名にする（例: `stroller.html`）
   - 中身を書き換える
   - `docs/index.html` の記事一覧にカードを1つ追加する

## 大事な注意（法律まわり）

- 2023年10月から、広告記事には「広告である」と分かる表示が義務になりました（ステマ規制）
- このサイトは各ページの最初に「アフィリエイト広告を利用しています」と表示済みです。**この表示は消さないでください**
- 使っていない商品を「使ってよかった」と書くのはNGです。実体験ベースで書きましょう

## 現実的な期待値

アフィリエイトは「作ってすぐがっぽり」にはなりません。
目安として、記事10本 + 3〜6ヶ月続けて、まず月数百円〜数千円が最初の目標です。
「これ着れる？」アプリとテーマが同じなので、アプリのユーザーとブログの読者を行き来させられるのが強みです。

## 更新のしかた（PowerShell）

このリポジトリを自分のPCに持ってくる（最初の1回だけ）:

```powershell
git clone https://github.com/far66266266-cmyk/kids-goods-blog.git
```

記事を直したあとGitHubに反映する:

```powershell
git add .
git commit -m "記事を更新"
git push
```
