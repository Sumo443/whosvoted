"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import InitialAvatar from "@/components/InitialAvatar";
import questionsData from "@/data/maker-questions.json";
import membersData from "@/data/members.json";
import type { MakerQuestion, Member } from "@/lib/data-loader";

const questions = questionsData as MakerQuestion[];
const membersList = membersData as Member[];

type Answer = "賛成" | "反対" | null;

export default function MakerPage() {
  const [step, setStep] = useState<"intro" | "quiz" | "result">("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(
    new Array(questions.length).fill(null)
  );
  const [results, setResults] = useState<
    { member_name: string; match_rate: number; faction: string | null; id: string | null }[]
  >([]);

  const progress =
    currentQ > 0 ? Math.round(((currentQ) / questions.length) * 100) : 0;

  const handleAnswer = (vote: "賛成" | "反対") => {
    const newAnswers = [...answers];
    newAnswers[currentQ] = vote;
    setAnswers(newAnswers);

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      // 計算
      calcResults(newAnswers);
    }
  };

  const handleSkip = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      // 全部スキップはありえないが一応
      calcResults([...answers]);
    }
  };

  const calcResults = (finalAnswers: Answer[]) => {
    // 回答済みの質問のみ計算
    const answered = finalAnswers
      .map((a, i) => ({ answer: a, q: questions[i] }))
      .filter((a) => a.answer !== null);

    if (answered.length === 0) {
      setResults([]);
      setStep("result");
      return;
    }

    // 全議員のスコアを計算
    const scores: Record<string, { match: number; total: number }> = {};

    for (const { answer, q } of answered) {
      const yeaSet = new Set(q.yeas.map(y => y.member_name));
      const naySet = new Set(q.nays.map(n => n.member_name));
      // 全ての議員をチェック（全議員が全投票に参加しているわけではない）
      for (const member of membersList) {
        const name = member.member_name;
        if (!scores[name]) scores[name] = { match: 0, total: 0 };
        if (yeaSet.has(name) || naySet.has(name)) {
          scores[name].total++;
          if (
            (answer === "賛成" && yeaSet.has(name)) ||
            (answer === "反対" && naySet.has(name))
          ) {
            scores[name].match++;
          }
        }
      }
    }

    const ranked = Object.entries(scores)
      .map(([member_name, s]) => {
        const member = membersList.find((m) => m.member_name === member_name);
        return {
          member_name,
          match_rate: Math.round((s.match / s.total) * 100),
          faction: member?.faction || null,
          id: member?.id || null,
        };
      })
      .filter((r) => r.match_rate > 0)
      .sort((a, b) => b.match_rate - a.match_rate)
      .slice(0, 3);

    setResults(ranked);
    setStep("result");
  };

  const restart = () => {
    setStep("intro");
    setCurrentQ(0);
    setAnswers(new Array(questions.length).fill(null));
    setResults([]);
  };

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
        {/* プログレスバー */}
        <div className="w-full bg-gray-100 rounded-full h-2 mb-8">
          <div
            className="bg-[#1D9E75] h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mb-2">
          {currentQ + 1} / {questions.length}
        </p>
        <h2 className="text-lg font-bold text-gray-900 mb-2 leading-relaxed">
          {q.bill_name}
        </h2>
        {q.description && (
          <p className="text-sm text-gray-500 mb-2 leading-relaxed">
            {q.description}
          </p>
        )}
        <p className="text-xs text-gray-400 mb-8">{q.date}</p>

        <p className="text-sm text-gray-600 mb-4">
          あなたならどうする？
        </p>

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => handleAnswer("賛成")}
            className="flex-1 bg-green-50 text-[#1D9E75] font-medium py-3 rounded-xl border border-green-200 hover:bg-green-100 transition-colors"
          >
            賛成
          </button>
          <button
            onClick={() => handleAnswer("反対")}
            className="flex-1 bg-red-50 text-red-500 font-medium py-3 rounded-xl border border-red-200 hover:bg-red-100 transition-colors"
          >
            反対
          </button>
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
  return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center">
      <span className="text-4xl">🎉</span>

      {results.length > 0 ? (
        <>
          <h2 className="text-xl font-bold text-gray-900 mt-4 mb-2">
            あなたの推し議員は
            <span className="text-[#1D9E75]">
              {results[0].member_name}
            </span>
            さんです！
          </h2>
          <p className="text-sm text-gray-400 mb-8">
            {answers.filter((a) => a !== null).length}問の判定結果
          </p>

          <div className="space-y-3 mb-8 text-left">
            {results.map((r, i) => (
              <div
                key={r.member_name}
                className="border border-gray-100 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-300 w-6">
                    #{i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {r.member_name}
                    </p>
                    <p className="text-xs text-gray-400">{r.faction || ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1D9E75]">
                    一致率{r.match_rate}%
                  </span>
                  <Link
                    href={`/member/${r.id || ""}`}
                    className="text-xs text-gray-300 hover:text-[#1D9E75]"
                  >
                    詳しく見る →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Xシェア（最重要） */}
          {results.length > 0 && (
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                `私の推し議員は${results[0].member_name}議員でした！（一致率${results[0].match_rate}%）\nあなたの推し議員は？→ https://whosvoted.com/maker #WHO_VOTED`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-black text-white font-medium px-6 py-3 rounded-full hover:bg-gray-800 transition-colors"
            >
              𝕏 でシェア
            </a>
          )}
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
