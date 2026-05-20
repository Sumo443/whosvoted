"use client";

import { useState } from "react";
import Link from "next/link";
import InitialAvatar from "@/components/InitialAvatar";
import questionsData from "@/data/maker-questions.json";
import membersData from "@/data/members.json";
import type { MakerQuestion, Member } from "@/lib/data-loader";

const questions = questionsData as MakerQuestion[];
const membersList = membersData as Member[];

type AnswerValue = 2 | 1 | 0 | -1 | -2;

const ANSWER_LABELS: { value: AnswerValue; label: string; color: string; bg: string; border: string }[] = [
  { value: 2, label: "強く賛成", color: "text-[#1D9E75]", bg: "bg-green-50", border: "border-green-200" },
  { value: 1, label: "やや賛成", color: "text-[#58b99a]", bg: "bg-green-50/50", border: "border-green-100" },
  { value: 0, label: "中立", color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" },
  { value: -1, label: "やや反対", color: "text-[#e67a7a]", bg: "bg-red-50/50", border: "border-red-100" },
  { value: -2, label: "強く反対", color: "text-red-500", bg: "bg-red-50", border: "border-red-200" },
];

export default function MakerPage() {
  const [step, setStep] = useState<"intro" | "quiz" | "result">("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<AnswerValue[]>(
    new Array(questions.length).fill(null) as unknown as AnswerValue[]
  );
  const [results, setResults] = useState<
    { member_name: string; match_rate: number; faction: string | null; id: string | null; answered: number }[]
  >([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const progress =
    currentQ > 0 ? Math.round(((currentQ) / questions.length) * 100) : 0;

  const handleAnswer = (value: AnswerValue) => {
    const newAnswers = [...answers];
    newAnswers[currentQ] = value;
    setAnswers(newAnswers);

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      calcResults(newAnswers);
    }
  };

  const handleSkip = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      calcResults([...answers]);
    }
  };

  const calcResults = (finalAnswers: AnswerValue[]) => {
    const answered = finalAnswers
      .map((a, i) => ({ answer: a, q: questions[i], index: i }))
      .filter((a) => a.answer !== null);

    if (answered.length === 0) {
      setResults([]);
      setStep("result");
      return;
    }

    // 全質問の参加者セット
    const questionSets = answered.map(({ q, index }) => ({
      index,
      yeas: new Set(q.yeas.map(y => y.member_name)),
      nays: new Set(q.nays.map(n => n.member_name)),
    }));

    // 3問以上に投票している議員のみ対象（最低100名以上）
    const MIN_ANSWERS = 3;
    const memberVoteCounts: Record<string, number> = {};
    for (const member of membersList) {
      const name = member.member_name;
      let count = 0;
      for (const qs of questionSets) {
        if (qs.yeas.has(name) || qs.nays.has(name)) count++;
      }
      if (count >= MIN_ANSWERS) memberVoteCounts[name] = count;
    }

    // スコア計算（5段階対応、回答がない設問はスキップ）
    const MAX_DIFF = 4;
    const scores: Record<string, { total_pct: number; count: number }> = {};

    for (const { answer: userVal, index } of answered) {
      const qs = questionSets.find(qs => qs.index === index)!;
      for (const name of Object.keys(memberVoteCounts)) {
        const mv = qs.yeas.has(name) ? 1 : qs.nays.has(name) ? -1 : null;
        if (mv === null) continue;
        const diff = Math.abs(userVal - mv);
        const pct = Math.round((1 - diff / MAX_DIFF) * 100);
        if (!scores[name]) scores[name] = { total_pct: 0, count: 0 };
        scores[name].total_pct += pct;
        scores[name].count++;
      }
    }

    const ranked = Object.entries(scores)
      .map(([member_name, s]) => {
        const member = membersList.find((m) => m.member_name === member_name);
        return {
          member_name,
          match_rate: Math.round(s.total_pct / s.count),
          faction: member?.faction || null,
          id: member?.id || null,
          answered: memberVoteCounts[member_name] || 0,
        };
      })
      .filter((r) => r.match_rate > 0)
      .sort((a, b) => b.match_rate - a.match_rate || b.answered - a.answered)
      .slice(0, 20);

    setResults(ranked);
    setStep("result");
  };

  const shareText = (name: string, rate: number) =>
    `推し議員メーカーで診断したら${name}議員（一致率${rate}%）と近かった！\nあなたの推し議員は？→ https://whosvoted.com/maker #WHO_VOTED`;

  const restart = () => {
    setStep("intro");
    setCurrentQ(0);
    setAnswers(new Array(questions.length).fill(null) as unknown as AnswerValue[]);
    setResults([]);
    setSelectedMember(null);
  };

  const answeredList = answers
    .map((a, i) => ({ answer: a, q: questions[i], index: i }))
    .filter((a) => a.answer !== null) as { answer: AnswerValue; q: MakerQuestion; index: number }[];

  const answerLabel = (val: AnswerValue) => ANSWER_LABELS.find(l => l.value === val)?.label || "";

  // === イントロ画面 ===
  if (step === "intro") {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <span className="text-4xl">✨</span>
        <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-3">
          あなたの推し議員を見つけよう
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          実際の採決をもとに、あなたに近い議員を診断します。
          <br />
          {questions.length}問の質問に答えるだけ。
        </p>
        <button
          onClick={() => setStep("quiz")}
          className="bg-[#1D9E75] text-white font-medium px-8 py-3 rounded-full hover:bg-[#188a63] transition-colors"
        >
          はじめる
        </button>
      </div>
    );
  }

  // === 質問画面 ===
  if (step === "quiz") {
    const q = questions[currentQ];
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="w-full bg-gray-100 rounded-full h-2 mb-8">
          <div
            className="bg-[#1D9E75] h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mb-2">
          {currentQ + 1} / {questions.length}
        </p>
        <h2 className="text-lg font-bold text-gray-900 mb-3 leading-relaxed">
          {q.question || q.bill_name}
        </h2>
        {q.description && (
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            {q.description}
          </p>
        )}
        <div className="flex flex-col gap-2 mb-4">
          {ANSWER_LABELS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleAnswer(opt.value)}
              className={`${opt.bg} ${opt.color} ${opt.border} font-medium py-3 px-4 rounded-xl border hover:opacity-80 transition-all text-left`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleSkip}
          className="w-full text-xs text-gray-300 hover:text-gray-500 transition-colors"
        >
          わからない（スキップ）
        </button>
      </div>
    );
  }

  // === 結果画面 ===
  const top = results[0];

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <span className="text-4xl">🎉</span>

      {results.length > 0 ? (
        <>
          {/* メインの推し議員 */}
          <h2 className="text-xl font-bold text-gray-900 mt-4 mb-2">
            あなたの推し議員は
            <span className="text-[#1D9E75]">
              {top.member_name}
            </span>
            さんです！
          </h2>
          <p className="text-sm text-gray-400 mb-2">
            {answeredList.length}問の判定結果
          </p>
          <div className="bg-gray-50 rounded-lg p-3 mb-6 text-left">
            <p className="text-xs text-gray-500 leading-relaxed">
              あなたと投票行動の傾向が近い議員です。
              特定の政策を推奨する意図はありません。
              データは国会会議録に基づいています。
            </p>
          </div>

          {/* 回答と法案の対応表（折りたたみ） */}
          <details className="mb-6 text-left">
            <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700">
              あなたの回答を見る
            </summary>
            <div className="mt-3 space-y-2">
              {answeredList.map((a) => (
                <div key={a.index} className="text-xs border border-gray-100 rounded-lg p-3">
                  <p className="text-gray-800 font-medium mb-1">
                    {a.q.question || a.q.bill_name}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">{a.q.date}</span>
                    <span className={`font-medium ${a.answer > 0 ? "text-[#1D9E75]" : a.answer < 0 ? "text-red-500" : "text-gray-400"}`}>
                      {answerLabel(a.answer)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </details>

          {/* TOP20リスト */}
          <h3 className="text-base font-bold text-gray-700 mb-3 text-left">
            あなたと投票傾向が近い議員 TOP{results.length}
          </h3>
          <div className="space-y-2 mb-6 text-left max-h-[500px] overflow-y-auto">
            {results.map((r, i) => (
              <div key={r.member_name}>
                <button
                  onClick={() => setSelectedMember(selectedMember === r.member_name ? null : r.member_name)}
                  className={`w-full border rounded-lg p-3 flex items-center justify-between transition-all text-left ${
                    selectedMember === r.member_name
                      ? "border-[#1D9E75] bg-green-50"
                      : "border-gray-100 hover:border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-bold text-gray-300 w-5 shrink-0">
                      {i + 1}
                    </span>
                    <InitialAvatar name={r.member_name} size={28} faction={r.faction} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {r.member_name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{r.faction || ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs text-gray-400">{r.answered}問</span>
                    <span className="text-sm font-bold text-[#1D9E75]">
                      {r.match_rate}%
                    </span>
                    <Link
                      href={`/member/${r.id || ""}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-gray-300 hover:text-[#1D9E75]"
                    >
                      詳細
                    </Link>
                  </div>
                </button>

                {/* シェアボタン */}
                {selectedMember === r.member_name && (
                  <div className="mt-1 mb-2 text-right">
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(r.member_name, r.match_rate))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-black text-white text-xs font-medium px-4 py-2 rounded-full hover:bg-gray-800 transition-colors"
                    >
                      𝕏 でシェア（{r.member_name}）
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 全体シェア */}
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(top.member_name, top.match_rate))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-black text-white font-medium px-6 py-3 rounded-full hover:bg-gray-800 transition-colors"
          >
            𝕏 でシェア
          </a>
        </>
      ) : (
        <>
          <h2 className="text-xl font-bold text-gray-900 mt-4 mb-2">
            もう一度試してみてね！
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            回答なしでは判定できませんでした。
          </p>
        </>
      )}

      <button
        onClick={restart}
        className="block mx-auto mt-6 text-sm text-gray-400 hover:text-gray-600"
      >
        もう一度診断する
      </button>
    </div>
  );
}
