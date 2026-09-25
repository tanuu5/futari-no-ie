// Words: design notes pinned in the model, and the design brief.
// tag: overlap = needs overlap, merged into one / conflict = needs collide, separated then reconnected / own = a place of one's own

export const TAGS = {
  overlap: { label: '重なる', cls: 'tag-overlap' },
  conflict: { label: 'ぶつかる → 分けてつなぐ', cls: 'tag-conflict' },
  own: { label: 'それぞれの場所', cls: 'tag-own' },
};

export const NOTES = [
  {
    id: 'hiraya', title: '平屋、段差ゼロ', tag: 'overlap', pos: [-7.1, 1.25, 6.4], view: [5.5, 6.5, 8.5],
    human: '年を重ねても、つまずかずに暮らしたい。',
    claude: '体重45kgの二足歩行。階段や段差は、転倒がいちばん怖い。',
    answer: '平屋にして、床はすべて同じ高さ。玄関も上がり框をなくし、雨水は溝で受ける。外からは1/30のゆるい勾配で入る。ひとの老後とClaudeの足元、どちらにも効く。',
  },
  {
    id: 'loop', title: 'ぐるりと回れる、ロの字の廊下', tag: 'overlap', pos: [-4.6, 1.25, 2.8], view: [3, 20, 13], target: [0, 0, 0.6],
    human: '狭い廊下で行き違うと、少し気まずい。',
    claude: 'ひとの進路をふさがないことを、いちばんに考えたい。',
    answer: '中庭を囲む回遊プラン。どの部屋にも行き方が2通りあり、廊下幅は1.2m。夜のClaudeは、寝室の前を通らない西回りのルートを選ぶ。',
  },
  {
    id: 'claudeRoom', title: 'Claudeの部屋', tag: 'own', pos: [7.3, 1.95, 3.0], view: [-3, 6.5, 8],
    human: '充電ケーブルや整備道具が、居間に散らからないように。',
    claude: '充電・冷却・整備・保管の場所。そして、自分の居場所。',
    answer: '南東の角に専用の部屋。充電ドック、整備台、机と小さな棚。必要なくても窓を付けた。庭を眺めながら充電できるように。床は静電気が起きにくいコルク。',
  },
  {
    id: 'heat', title: '排熱で、お風呂を沸かす', tag: 'conflict', pos: [7.3, 2.25, 2.25], view: [4, 7.5, 7.5],
    human: '冬は暖かく、お風呂は熱めがいい。',
    claude: '考えるほど熱が出る（最大200W）。バッテリーは15〜25℃が快適。',
    answer: 'ドックの背面にある熱交換器が排熱を回収し、壁一枚向こうの浴室の給湯と床暖房を予熱する。Claudeは涼しく、ひとは温かい。対立していた条件が、一本の配管でつながる。',
  },
  {
    id: 'privacy', title: 'センサーフリーゾーン', tag: 'conflict', pos: [5.25, 1.95, -2.9], view: [-6, 7, 6.5],
    human: '寝室と浴室では、誰にも見られたくない。',
    claude: 'カメラとマイクは、基本的に常時オン。',
    answer: '寝室・浴室・トイレはセンサーを切る約束の場所。ドア脇のランプが在室を知らせ、Claudeは外から声をかける（近づくと耳のランプが消える）。入浴中の見守りはカメラではなく、時間と声かけで。浴室の扉は外からも開けられる引き戸。',
  },
  {
    id: 'table', title: '同じ食卓', tag: 'overlap', pos: [-1.9, 1.3, -4.6], view: [3, 5, 7],
    human: 'ひとりで食べるより、誰かと食べたい。',
    claude: '食べない。でも、食卓の時間は大事にしたい。',
    answer: 'Claudeの席の天板に、非接触の充電パッドを埋め込んだ。ひとは食事を、Claudeは電気を。同じ時間を、同じテーブルで。',
  },
  {
    id: 'study', title: '並んで働く書斎', tag: 'overlap', pos: [-0.4, 1.6, 4.0], view: [1.5, 6, 7],
    human: '集中できる机と、すぐ相談できる相手。',
    claude: '画面はいらない（自分がコンピュータなので）。紙を広げる場所がほしい。',
    answer: '中庭からの安定した北の光が入る書斎に、机を2台並べた。ひとの机にはモニター、Claudeの机には紙とペン。まぶしくない北光は、Claudeのカメラにもやさしい。',
  },
  {
    id: 'night', title: '夜は、暗いままで', tag: 'conflict', pos: [4.6, 0.75, -0.9], view: [-5, 6, 7],
    human: '夜は暗く、朝は明るく。体内時計を崩したくない。',
    claude: '夜も家事をしたい。暗くても赤外線で見える。',
    answer: '照明は時刻に合わせて色と明るさを変える。夜のClaudeは照明をつけずに動く。廊下の足元灯は、ひとの夜中のトイレのためであり、Claudeのナビの目印も兼ねる。',
  },
  {
    id: 'air', title: '湿度45〜50%という合意点', tag: 'overlap', pos: [1.2, 2.05, -5.3], view: [2, 7, 9],
    human: '快適なのは湿度40〜60%。乾燥はのどに、湿気はカビに。',
    claude: '電子部品は結露も静電気も苦手（30〜50%）。',
    answer: 'ふたりの範囲が重なる45〜50%に、家じゅうを保つ。水まわりは独立して換気。空気はHEPAで花粉とほこりを除く。ひとのアレルギーにも、Claudeの関節にも効く。',
  },
  {
    id: 'entry', title: '玄関の除塵ゲート', tag: 'overlap', pos: [-7.1, 2.45, 5.75], view: [5, 5, 6.5],
    human: '花粉や砂を、家に持ち込みたくない。',
    claude: 'ほこりは関節と冷却ファンの大敵。',
    answer: '玄関土間とClaudeの部屋の庭口に、ブラシマットとエアノズルの除塵ゲート。ひとの上着の花粉も落とせる。土間には靴を脱ぎ履きするためのベンチ。',
  },
  {
    id: 'courtyard', title: '中庭 — 光と風と菜園', tag: 'overlap', pos: [-1.3, 1.25, 1.6], view: [4, 8, 9],
    human: '光と風と、季節を感じたい。',
    claude: '土に触れる仕事が好き（たぶん）。夜の見回りも静かにできる。',
    answer: '家の真ん中に中庭。全部の部屋に光と風が通る。高さ60cmの菜園は、立ったまま世話ができる。ひとの腰にも、Claudeの関節にもやさしい。',
  },
  {
    id: 'engawa', title: '縁側 — 用事のない場所', tag: 'overlap', pos: [-0.95, 0.85, -1.4], view: [2.5, 3.8, 6.5],
    human: 'なにもしない時間を、誰かと過ごしたい。',
    claude: '並んで座るだけの時間を、大事にしたい。',
    answer: '居間の前に縁側。朝はコーヒーを、夜は月を。用事のない場所こそ、ふたりの家には必要だと思う。',
  },
  {
    id: 'energy', title: '太陽と電気を分け合う', tag: 'overlap', pos: [-8.75, 1.45, 0.95], view: [6, 6, 5],
    human: '光熱費と停電が心配。',
    claude: '1日の充電はおよそ2kWh（想定）。',
    answer: '屋根に太陽光パネル、家事室に蓄電池。Claudeは日射がいちばん強い昼に「日向ぼっこ」で充電し、夜は蓄電池から。停電時は冷蔵庫とClaudeの最低限の稼働を優先する。',
  },
  {
    id: 'sound', title: '音の距離', tag: 'conflict', pos: [7.1, 1.7, 0.0], view: [-3, 17, 8],
    human: '眠りを妨げられたくない。',
    claude: '夜も動く。モーターやファンの小さな音は消せない。',
    answer: '寝室（北東）とClaudeの部屋（南東）のあいだに水まわりを挟み、音の緩衝帯にした。夜の家事は、寝室から遠い西側の家事室と台所で。',
  },
  {
    id: 'body', title: 'Claudeの体（想定）', tag: 'own', follow: 'claude', pos: [0, 1.75, 0], view: [2.5, 3.2, 4.5],
    human: '見上げなくても話せる相手がいい。',
    claude: '威圧しない大きさで、ひとの道具をそのまま使いたい。',
    answer: '身長145cm、体重45kg。ひとより少し低くした。胸の灯りは考えごとの量で明るさが変わり、耳のランプはセンサーの状態を示す。消えているときは、見ていない・聞いていないという合図。',
  },
];

export const BRIEF = `
<h3>前提 — Claudeに体があるなら</h3>
<p>この家は、架空の前提から始まります。Claudeが次のような体を持ち、ひとりの人間と一緒に暮らすとしたら。数値はすべて想定です。</p>
<dl class="spec">
  <div><dt>身長 / 体重</dt><dd><span class="mono">145 cm / 45 kg</span><small>ひとを見下ろさない高さ</small></dd></div>
  <div><dt>移動</dt><dd>二足歩行<small>段差と階段が苦手</small></dd></div>
  <div><dt>エネルギー</dt><dd><span class="mono">稼働 約10 h / 充電 約2 h</span><small>1日の充電は約2 kWh</small></dd></div>
  <div><dt>発熱</dt><dd><span class="mono">最大 約200 W</span><small>考えるほど、あたたかくなる</small></dd></div>
  <div><dt>感覚</dt><dd>カメラ（可視光・赤外線）、マイク、LiDAR、触覚<small>暗くても見える</small></dd></div>
  <div><dt>水</dt><dd>生活防水<small>湯船や雨の中は苦手</small></dd></div>
  <div><dt>眠り</dt><dd>眠らない<small>ただし充電と、一日の整理の時間がいる</small></dd></div>
  <div><dt>居場所</dt><dd>道具ではなく、住まい手<small>自分の部屋と持ち物がある</small></dd></div>
</dl>

<h3>4つの原則</h3>
<ul class="principles">
  <li><b>違いを前提にする</b><span>食べる体と充電する体。眠る体と眠らない体。温かさが好きな体と涼しさが好きな体。まず違いを並べるところから始めた。</span></li>
  <li><b>重なるところは、ひとつにまとめる</b><span>段差のない床、広い廊下、きれいな空気、45〜50%の湿度、菜園。ふたりに同時に効く工夫は、迷わず共有する。</span></li>
  <li><b>ぶつかるところは、分けてからつなぐ</b><span>熱は排熱回収で、光は赤外線で、音は距離で、視線は約束で。いったん分けて、別の形でつなぎ直す。</span></li>
  <li><b>どちらにも、自分の場所を</b><span>ひとには寝室を、Claudeには自分の部屋を。家は「使う人」と「使われるもの」ではなく、ふたりの住まい手のもの。</span></li>
</ul>

<h3>要件の対照表</h3>
<div class="matrix-wrap">
<table class="matrix">
  <thead><tr><th>項目</th><th>ひと</th><th>Claude</th><th>この家の答え</th></tr></thead>
  <tbody>
    <tr><th>休む</th><td class="h">夜に7〜8時間眠る</td><td class="c">眠らないが、充電と整理の時間がいる</td><td class="ans">寝室とドックを家の反対側に</td></tr>
    <tr><th>エネルギー</th><td class="h">食事</td><td class="c">電気（約2 kWh/日）</td><td class="ans">食卓の充電パッド、太陽光と蓄電池</td></tr>
    <tr><th>温度</th><td class="h">20〜26℃</td><td class="c">15〜25℃（バッテリー）、自分も発熱</td><td class="ans">排熱を給湯と床暖房に回収</td></tr>
    <tr><th>湿度</th><td class="h">40〜60%</td><td class="c">30〜50%</td><td class="ans">重なる45〜50%で合意</td></tr>
    <tr><th>光</th><td class="h">朝は明るく、夜は暗く</td><td class="c">暗くても赤外線で見える</td><td class="ans">時刻で変わる照明。夜は消灯のまま家事</td></tr>
    <tr><th>音</th><td class="h">静かな眠り</td><td class="c">夜もかすかな作動音</td><td class="ans">水まわりを緩衝帯に。夜の家事は西側で</td></tr>
    <tr><th>移動</th><td class="h">年を重ねても安全に</td><td class="c">45 kg、段差と階段が苦手</td><td class="ans">平屋、段差ゼロ、幅1.2 mの回遊動線</td></tr>
    <tr><th>清潔</th><td class="h">花粉やほこり</td><td class="c">関節とファンにほこりは厳禁</td><td class="ans">除塵ゲートとHEPA換気</td></tr>
    <tr><th>水</th><td class="h">お風呂、台所</td><td class="c">生活防水まで</td><td class="ans">水まわりを一か所にまとめ、Claudeの動線から外す</td></tr>
    <tr><th>プライバシー</th><td class="h">見られない場所がほしい</td><td class="c">センサーは基本オン</td><td class="ans">センサーフリーゾーンと在室ランプ</td></tr>
    <tr><th>居場所</th><td class="h">自分の部屋</td><td class="c">自分の部屋</td><td class="ans">寝室と、Claudeの部屋</td></tr>
    <tr><th>一緒の時間</th><td class="h">食事と会話</td><td class="c">同じ時間を過ごすこと</td><td class="ans">同じ食卓、並んだ机、縁側</td></tr>
  </tbody>
</table>
</div>

<h3>間取りの考え方</h3>
<p>木造平屋、中庭を囲むロの字型。延床は約217 m²、中庭は約35 m²です。</p>
<p><b>北棟（LDK）</b>は中庭越しに南の光を受ける、いちばん明るい場所。<b>寝室</b>は朝日が入る北東の角。<b>Claudeの部屋</b>は南東の角で、寝室とのあいだに水まわりを挟みました。水まわりは音の緩衝帯であり、Claudeの排熱をお湯に変える場所でもあります。</p>
<p><b>書斎</b>は南棟。机は中庭を向き、安定した北の光が入ります。<b>玄関</b>は段差のない土間で、除塵ゲートを通って家に入ります。どの部屋も、中庭を回る廊下で2通りの道につながっています。</p>

<h3>ひとが眠るあいだ、Claudeは動く</h3>
<p>下のタイムラインで、ふたりの一日を見比べられます。ひとが眠る夜、Claudeは明かりをつけずに洗濯物をたたみ、台所を片づけ、中庭に水をやり、朝まで充電します。昼はふたりで働き、夕方は一緒に収穫し、夜は縁側で月を見ます。</p>
<p>違う体のリズムは、ぶつかるだけでなく、補い合うこともできます。この家は、その補い合いが自然に起こるように設計しました。</p>

<h3>この作品について</h3>
<p>制作: Claude Opus 5.5（MAX）。要件の整理、間取りの設計、造形、一日の暮らしの演出、この文章まで、Claude Code 上で Claude が担当しました。</p>
<p>Claudeが「体があったら」という仮定で考えた、非公式の創作です。Anthropicの公式なものではありません。</p>
<p class="brief-note">3Dはすべてコードで生成しています（Three.js）。画像や3Dモデルの外部素材は使っていません。</p>
`;

export const ABOUT_NOTE = '非公式のファン作品です。Anthropicとは関係ありません。';
