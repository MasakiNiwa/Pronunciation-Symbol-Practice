# Pronunciation Symbol Practice

自分が発した英語の音をIPA（国際音声記号）として見て、基準の発音記号と比較する実験アプリです。単語認識から辞書のIPAを引く機能と、音声そのものからIPAを推定する機能を明確に区別します。

## 2つのモード

| モード | 処理 | 分かること | 制約 |
| --- | --- | --- | --- |
| 音声 → IPA | マイク → Web Audio → 16kHzモノラル → 端末内音素モデル | 音声から推定したIPA、音ごとの追加・欠落・置換 | 初回約355MB＋実行ライブラリ、メモリ消費大、推定誤りあり |
| 音声 → 単語 | Web Speech API → 認識単語 → 辞書IPA | どの単語として認識されたか | 実際の発音をIPAにした結果ではなく、発音評価には使えない |

ブラウザ標準には音声をIPAに直接変換するAPIがありません。録音・再生・再サンプリング・単語認識・読み上げは標準APIで行い、不足する音素推定には無料公開モデル、任意単語の基準IPAには無料辞書APIを利用します。有料APIキーや独自サーバーは不要です。

## 試し方

1. 練習単語を選択（最初は right / light、ship / sheep など）。
2. 基準IPAを確認。辞書に複数候補があれば選択、または手入力。
3. 「モデルを準備する」を押す。Wi-Fi・PCでの初回利用を推奨。
4. 「録音してみる」で1語を発音し停止（最大8秒、自動停止）。
5. 推定IPAを確認し、録音を再生して基準と見比べる。
6. モデルが重い場合は「中止・モデル解放」。標準機能だけ試す場合は「音声 → 単語」へ。

スマートフォン向けの画面にも対応していますが、Pixelなどの実機でのメモリ使用量・認識品質の検証は別途必要です。利用可否はマイク・AudioWorklet・SpeechRecognitionの機能検出で判断します。単語認識はブラウザ・OS・認識サービスによって動作が異なります。

読み上げは端末のTTSです。選択したIPAをそのまま合成するものではありません。US/UKの設定は「音声 → 単語」内にあり、読み上げにも反映します。内蔵基準IPAは広い米語表記です。外部辞書の各候補には地域タグが保証されていません。自分の基準に合うIPAを選ぶか編集してください。

## 比較の意味と限界

- 音素モデル: [robg/speako-phoneme-recognizer](https://huggingface.co/robg/speako-phoneme-recognizer)、revision ad0f63c、q8、WASM/CPU。
- TIMIT由来の39音素に基づく推定です。音声学的な精密測定ではありません。母語話者の発音や辞書IPAとも完全一致しない場合があります。
- 音素列のLevenshtein距離から「記号の一致度」を算出します。発音の上手さ・通じやすさを保証する点数ではありません。
- スラッシュ・空白・強勢・音節境界・長さ記号を除き、ɹ/r、ɡ/g、破擦音の表記など限定的な正規化をします。r/l、ɪ/i、母音の地域差は勝手に同一視しません。
- このモデルは長さや強勢を評価しません。たとえばship/sheepの比較も、母音記号の差の実験であり長さの測定ではありません。
- 無音・短すぎる録音では解析を行わず再録音を案内します。外部辞書の失敗時には基準IPAを手入力できます。
- 違いが出た音は「モデルがそう推定した」音です。発音矯正の確定診断として扱わないでください。

## データの扱い・無料サービス

- IPAモード: アプリから音声を外部送信しません。モデル取得後の推論はWeb Worker内で実行。
- 単語認識: ブラウザ提供元の認識サーバーに音声が送られる場合があります。画面に説明を表示しています。
- 内蔵12語: 通信せず基準IPAを表示。独自に用意した広い米語表記です。
- その他の単語: [Free Dictionary API](https://dictionaryapi.dev/) に単語のみ送信。APIキー不要。可用性・収録範囲・利用条件は提供元に依存します。
- モデルと実行コード: Hugging Face / jsDelivrから取得。大きなダウンロードやメモリ確保に失敗した際は、再準備・標準認識への切替が可能。
- 音声はページのメモリ上にのみ保持。削除・再録音・移動・ページ終了で破棄。履歴やLocalStorageには保存しません。
- モデルはブラウザのCache APIに残る場合があります。削除はブラウザのサイトデータ設定から行ってください。
- Transformers.js 3.8.1とモデルrevisionを固定。自動追従はせず、更新時は実モデルのスモークテストを再実行してください。

## ローカル起動・GitHub Pages

Node.js 22以上とPython 3を推奨。アプリ自体はビルド不要です。

    npm start

http://localhost:8000 を開きます。file://ではES Modulesとマイクが動作しません。公開時はHTTPSが必要です。

GitHub Pagesには .github/workflows/pages.yml を用意しました。リポジトリの Settings → Pages → Build and deployment → Source を **GitHub Actions** に設定し、mainにマージすると公開されます。設定の変更・mainへのマージ・公開はこの実装PRとは別です。公開URLはデプロイ完了時にGitHub Actionsから確認してください。

## 検証

    npm test

比較ロジック、IPA表記差、追加・欠落、辞書の欠損・エラー、入力検証、WAV生成を確認します。外部サービスへの接続は不要です。

    npm install --no-save playwright@1.56.1
    npx playwright install chromium
    npm start
    # 別ターミナルで
    node tests/browser.mjs
    node tests/model-smoke.mjs

- browser.mjs: 音素モデルと単語認識をモックし、実際のAudioWorkletに人工音を流して、録音停止・16kHz化・推論への受渡し・比較画面・録音消去・表示モード・入力・スマホ幅を確認。
- model-smoke.mjs: 公開CDN・実モデルのロードと人工音の推論を確認。ネット接続・約355MBの取得が必要。認識精度のテストではありません。
- GitHub Actions Checkで単体・ブラウザ結合・実モデルのスモークテストを実行します。
- この作業環境では単体7件と構文チェックは成功。ブラウザプロセスの起動制限によりブラウザ・実モデルのテストはローカル実行できませんでした。GitHub Actionsの結果を確認してください。人間の英語音声やAndroid実機の精度・速度は未検証です。

## 他アプリへの組込み

src/ipa.js（正規化・アライメント）、src/dictionary.js（基準IPA取得）、src/audio.js（録音・再生用WAV・16kHz化）、src/phoneme-worker.js（IPA推定）を分離しました。画面はsrc/app.jsです。

録音を終えたらresampleで16kHz Float32Arrayを作り、workerへ {type:'transcribe', pcm} として送ります。workerは {type:'result', text} を返します。textをcompareIPA(reference, text)へ渡すと、差分と記号の一致度が得られます。単語認識の出力を実測IPAとして渡さないでください。

優先して次に検証すること: 実機での読み込み時間・メモリ、複数の人間の録音での音素誤認識、米英表記差、モデルの小型化。最初は単語単位の実験に限定し、文章の単語境界推定や厳密な発音採点は実装していません。

## 出典・ライセンス

アプリはMIT（LICENSE参照）。依存物と辞書データは各提供元の条件に従います。

- [Transformers.js](https://github.com/huggingface/transformers.js): Apache-2.0（CDN読込）
- [Speako phoneme model](https://huggingface.co/robg/speako-phoneme-recognizer): Apache-2.0、[元モデル](https://huggingface.co/vitouphy/wav2vec2-xls-r-300m-timit-phoneme)をONNX化。モデルはリポジトリに同梱しません。
- [Free Dictionary API](https://dictionaryapi.dev/): 任意単語のIPA。返却データのlicense/sourceUrlsは提供元レスポンス・公式サイトを確認。
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)、[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
