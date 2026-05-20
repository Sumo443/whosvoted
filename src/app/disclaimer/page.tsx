import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "このサイトについて / 免責事項 | WHO VOTED",
  description:
    "WHO VOTEDのデータソース、免責事項、連絡先について。",
};

export default function DisclaimerPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        このサイトについて
      </h1>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-3">
          WHO VOTED とは
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          WHO
          VOTEDは、国会議員の各法案に対する採決投票記録をわかりやすく可視化するサービスです。
          議員ごとの投票傾向を確認したり、「推し議員メーカー」機能であなたの考えに近い議員を見つけることができます。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-3">
          データソース
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-2">
          本サービスで使用しているデータは、以下の公式情報源を基にしています。
        </p>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
          <li>
            <a
              href="https://kokkai.ndl.go.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              国会会議録検索システム（国立国会図書館）
            </a>
          </li>
          <li>
            <a
              href="https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/shiryo/kaiha_m.htm"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              衆議院 会派別議員一覧
            </a>
          </li>
        </ul>
      </section>

      {/* 免責事項（必須） */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-3">
          免責事項
        </h2>
        <div className="text-sm text-gray-600 leading-relaxed space-y-3">
          <p>
            本サービスに掲載されている情報は、国立国会図書館が提供する「国会会議録検索システム」および衆議院公式サイトの情報を基に作成しています。
          </p>
          <p>
            データの正確性については最善を尽くしていますが、情報が完全であること、正確であること、最新であることを保証するものではありません。
          </p>
          <p>
            各投票記録には、一次情報である国会会議録へのリンクを併せて掲載しています。
            詳細を確認される際は、必ず一次情報をご確認ください。
          </p>
          <p>
            本サービスの情報を利用したことにより生じたいかなる損害についても、運営者は責任を負いかねます。
          </p>
          <p>
            議員個人の投票行動の掲載は、公開された公式情報に基づくものであり、
            特定の議員に対する誹謗中傷や名誉毀損を目的とするものではありません。
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-3">
          誤りの報告・お問い合わせ
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          データの誤りを発見された場合や、ご質問がある場合は、
          X（Twitter）アカウント
          <a
            href="https://x.com/WhoVotedJP"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            @WhoVotedJP
          </a>
          までDMにてお知らせください。
          対応にお時間をいただく場合がありますが、確認の上対応いたします。
        </p>
      </section>
    </div>
  );
}
