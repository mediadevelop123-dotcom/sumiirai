<?php
header('Content-Type: text/html; charset=UTF-8');
mb_internal_encoding('UTF-8');

require_once __DIR__ . '/config.php';

// ─── OpenAI 汎用呼び出し ──────────────────────────────────────

function call_openai(array $messages, int $max_tokens = 200): ?array {
    $payload = json_encode([
        'model'       => OPENAI_MODEL,
        'messages'    => $messages,
        'temperature' => 0.2,
        'max_tokens'  => $max_tokens,
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . OPENAI_API_KEY,
            'Content-Type: application/json',
        ],
    ]);
    $res = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($res, true);
    return $data['choices'][0]['message'] ?? null;
}

// ─── Step1: 質問をjGrants向けキーワードに変換 ────────────────

function extract_keywords(string $question): array {
    $msg = call_openai([
        ['role' => 'system', 'content' =>
            'ユーザーの質問から、jGrants（政府補助金ポータル）の検索に適した短い日本語キーワードを3つ抽出してください。' .
            '2〜4文字程度の業界用語・事業用語にしてください。「補助金」「支援」などの単語は含めないでください。' .
            'カンマ区切りのみで返してください（説明不要）。' .
            '例: 質問「ウェブ開発の費用を補助してほしい」→ IT導入,デジタル化,システム開発'],
        ['role' => 'user', 'content' => $question],
    ], 60);

    $text = $msg['content'] ?? '';
    $keywords = array_map('trim', explode(',', $text));
    return array_filter($keywords);
}

// ─── Step2: jGrants API 検索 ─────────────────────────────────

function search_jgrants(string $keyword, string $prefecture = ''): array {
    $params = http_build_query(array_filter([
        'keyword'            => $keyword,
        'acceptance'         => '1',
        'sort'               => 'created_date',
        'order'              => 'DESC',
        'target_area_search' => $prefecture ?: null,
    ]));
    $url = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies?' . $params;

    $ctx = stream_context_create(['http' => ['timeout' => 10]]);
    $json = @file_get_contents($url, false, $ctx);
    if ($json === false) return [];

    $data = json_decode($json, true);
    return $data['result'] ?? [];
}

function collect_subsidies(array $keywords, string $prefecture): array {
    $seen = [];
    $results = [];

    foreach ($keywords as $kw) {
        $items = search_jgrants($kw, $prefecture);
        // 都道府県指定でヒットなし → 全国で再検索
        if (empty($items) && $prefecture !== '') {
            $items = search_jgrants($kw, '');
        }
        foreach ($items as $s) {
            $id = $s['id'] ?? '';
            if ($id && !isset($seen[$id])) {
                $seen[$id] = true;
                $results[] = $s;
            }
            if (count($results) >= 5) break 2;
        }
    }
    return $results;
}

// ─── Step3: OpenAI で回答生成 ────────────────────────────────

function build_answer(string $question, array $subsidies): string {
    $parts = [];
    foreach ($subsidies as $i => $s) {
        $lines = ['【補助金' . ($i + 1) . '】' . ($s['title'] ?? $s['name'] ?? '不明')];
        if (!empty($s['detail']))                  $lines[] = '  内容: ' . mb_substr($s['detail'], 0, 300);
        if (!empty($s['use_purpose']))             $lines[] = '  対象: ' . $s['use_purpose'];
        if (!empty($s['subsidy_max_limit']))       $lines[] = '  最大補助額: ' . number_format((int)$s['subsidy_max_limit']) . '円';
        if (!empty($s['subsidy_rate']))            $lines[] = '  補助率: ' . $s['subsidy_rate'];
        if (!empty($s['target_area_search']))      $lines[] = '  地域: ' . $s['target_area_search'];
        if (!empty($s['acceptance_end_datetime'])) $lines[] = '  締切: ' . substr($s['acceptance_end_datetime'], 0, 10);
        $lines[] = '  ※jGrantsで「' . ($s['title'] ?? $s['name'] ?? '') . '」と検索してご確認ください。URL: https://www.jgrants-portal.go.jp/';
        $parts[] = implode("\n", $lines);
    }
    $context = implode("\n\n", $parts);

    $msg = call_openai([
        ['role' => 'system', 'content' =>
            "あなたは中小企業向け補助金アドバイザーです。\n" .
            "以下の補助金情報をもとに、ユーザーの質問に対して最適な補助金を日本語で丁寧に説明してください。\n\n" .
            "【回答ルール】\n" .
            "- 提供された補助金情報の中から最も適切なものを選んで説明してください\n" .
            "- 補助金名・最大補助額・締切・URLを必ず記載してください\n" .
            "- 提供された情報にない内容は答えないでください\n" .
            "- 最後に「詳細は各URLでご確認ください」と付け加えてください\n" .
            "- 「beta版のため参考情報としてご活用ください」と必ず注記してください\n\n" .
            "【検索された補助金情報】\n" . $context],
        ['role' => 'user', 'content' => $question],
    ], 1000);

    return $msg['content'] ?? 'AIからの回答取得に失敗しました。';
}

// ─── リクエスト処理 ───────────────────────────────────────────

$question   = trim($_POST['question']   ?? '');
$prefecture = trim($_POST['prefecture'] ?? '');
$subsidies  = [];
$ai_answer  = '';
$error      = '';
$keywords   = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $question !== '') {
    $keywords  = extract_keywords($question);
    $subsidies = collect_subsidies($keywords, $prefecture);

    if (empty($subsidies)) {
        $error = '該当する補助金が見つかりませんでした。別の言葉で質問してみてください。';
    } else {
        $ai_answer = build_answer($question, $subsidies);
    }
}

// 都道府県リスト
$prefectures = [
    '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
    '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
    '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
    '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
    '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
    '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
    '熊本県','大分県','宮崎県','鹿児島県','沖縄県',
];
?>
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>補助金AIアドバイザー（β）</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #f5f7fa; color: #1a1a2e; min-height: 100vh; padding: 2rem 1rem; }
  .container { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 1.6rem; font-weight: 700; }
  .subtitle { color: #666; font-size: 0.85rem; margin-top: 0.3rem; margin-bottom: 1.5rem; }
  .form-card { background: #fff; border-radius: 12px; padding: 1.5rem;
               box-shadow: 0 2px 8px rgba(0,0,0,.08); margin-bottom: 1.5rem; }
  textarea { width: 100%; border: 1.5px solid #d1d5db; border-radius: 8px;
             padding: 0.75rem; font-size: 0.9rem; resize: vertical;
             transition: border-color .2s; font-family: inherit; }
  textarea:focus { outline: none; border-color: #3b82f6; }
  .row { display: flex; gap: 0.75rem; margin-top: 0.75rem; flex-wrap: wrap; }
  select { border: 1.5px solid #d1d5db; border-radius: 8px; padding: 0.6rem 0.75rem;
           font-size: 0.85rem; background: #fff; cursor: pointer; }
  button[type=submit] { flex: 1; background: #3b82f6; color: #fff; border: none;
                        border-radius: 8px; padding: 0.7rem 1rem; font-size: 0.9rem;
                        font-weight: 600; cursor: pointer; transition: background .2s; }
  button[type=submit]:hover { background: #2563eb; }
  .keywords { font-size: 0.78rem; color: #6b7280; margin-top: 0.5rem; }
  .keywords span { background: #eff6ff; color: #3b82f6; border-radius: 4px;
                   padding: 0.1rem 0.5rem; margin-right: 0.3rem; }
  .error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
           padding: 1rem; color: #dc2626; font-size: 0.875rem; margin-bottom: 1rem; }
  .answer-card { background: #fff; border-radius: 12px; padding: 1.5rem;
                 box-shadow: 0 2px 8px rgba(0,0,0,.08); margin-bottom: 1.5rem; }
  .answer-card h2 { font-size: 0.9rem; font-weight: 600; color: #374151; margin-bottom: 0.75rem; }
  .answer-text { font-size: 0.9rem; line-height: 1.75; white-space: pre-wrap; color: #1f2937; }
  .section-title { font-size: 0.85rem; font-weight: 600; color: #374151; margin-bottom: 0.75rem; }
  .subsidy-card { background: #fff; border-radius: 10px; padding: 1rem 1.25rem;
                  box-shadow: 0 1px 4px rgba(0,0,0,.07); margin-bottom: 0.75rem;
                  border-left: 4px solid #3b82f6; }
  .subsidy-title { font-size: 0.95rem; font-weight: 700; color: #1f2937; margin-bottom: 0.4rem; }
  .subsidy-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.78rem;
                  color: #6b7280; margin-top: 0.5rem; }
  .subsidy-link { display: inline-block; margin-top: 0.6rem; font-size: 0.8rem;
                  color: #3b82f6; text-decoration: none; }
  .subsidy-link:hover { text-decoration: underline; }
  .footer-note { text-align: center; font-size: 0.75rem; color: #9ca3af; margin-top: 1.5rem; }
</style>
</head>
<body>
<div class="container">
  <h1>補助金AIアドバイザー</h1>
  <p class="subtitle">質問を入力すると、AIが最適な補助金を提案します。（β版 / 参考情報）</p>

  <div class="form-card">
    <form method="post" action="">
      <textarea name="question" rows="3"
        placeholder="例：飲食店の設備投資に使える補助金はありますか？"
        required><?= htmlspecialchars($question, ENT_QUOTES, 'UTF-8') ?></textarea>
      <div class="row">
        <select name="prefecture">
          <option value="">全国</option>
          <?php foreach ($prefectures as $p): ?>
            <option value="<?= $p ?>" <?= $prefecture === $p ? 'selected' : '' ?>><?= $p ?></option>
          <?php endforeach; ?>
        </select>
        <button type="submit">補助金を探す →</button>
      </div>
    </form>
    <?php if (!empty($keywords)): ?>
      <p class="keywords">
        検索キーワード：
        <?php foreach ($keywords as $kw): ?>
          <span><?= htmlspecialchars($kw, ENT_QUOTES, 'UTF-8') ?></span>
        <?php endforeach; ?>
      </p>
    <?php endif; ?>
  </div>

  <?php if ($error): ?>
    <div class="error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
  <?php endif; ?>

  <?php if ($ai_answer): ?>
    <div class="answer-card">
      <h2>🤖 AIの回答</h2>
      <div class="answer-text"><?= htmlspecialchars($ai_answer, ENT_QUOTES, 'UTF-8') ?></div>
    </div>

    <p class="section-title">参照した補助金（jGrants より）</p>
    <?php foreach ($subsidies as $s): ?>
      <div class="subsidy-card">
        <div class="subsidy-title">
          <?= htmlspecialchars($s['title'] ?? $s['name'] ?? '不明', ENT_QUOTES, 'UTF-8') ?>
        </div>
        <?php if (!empty($s['subsidy_catch_phrase'])): ?>
          <p style="font-size:.82rem;color:#4b5563;margin-top:.25rem">
            <?= htmlspecialchars($s['subsidy_catch_phrase'], ENT_QUOTES, 'UTF-8') ?>
          </p>
        <?php endif; ?>
        <div class="subsidy-meta">
          <?php if (!empty($s['subsidy_max_limit'])): ?>
            <span>💰 最大 <?= number_format((int)$s['subsidy_max_limit']) ?>円</span>
          <?php endif; ?>
          <?php if (!empty($s['subsidy_rate'])): ?>
            <span>📊 <?= htmlspecialchars($s['subsidy_rate'], ENT_QUOTES, 'UTF-8') ?></span>
          <?php endif; ?>
          <?php if (!empty($s['target_area_search'])): ?>
            <span>📍 <?= htmlspecialchars($s['target_area_search'], ENT_QUOTES, 'UTF-8') ?></span>
          <?php endif; ?>
          <?php if (!empty($s['acceptance_end_datetime'])): ?>
            <span>⏰ 締切 <?= htmlspecialchars(substr($s['acceptance_end_datetime'], 0, 10), ENT_QUOTES, 'UTF-8') ?></span>
          <?php endif; ?>
        </div>
        <a class="subsidy-link"
           href="https://www.jgrants-portal.go.jp/"
           target="_blank" rel="noopener">jGrantsで確認する →</a>
      </div>
    <?php endforeach; ?>
  <?php endif; ?>

  <p class="footer-note">
    β版のため情報は参考程度にご利用ください。最新情報は各補助金の公式ページでご確認ください。
  </p>
</div>
</body>
</html>
