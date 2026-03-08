'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { ExerciseTemplate, GeneratedQuestion, SessionAnswer } from '@/lib/types';
import { generateSession, checkAnswer } from '@/lib/randomizer';
import { createClient } from '@/lib/supabase/client';

interface Props {
  template: ExerciseTemplate;
  userId:   string;
}

type Phase = 'intro' | 'playing' | 'result';

export default function ExercisePlayer({ template, userId }: Props) {
  const router   = useRouter();
  const supabase = createClient();

  const [phase,        setPhase]        = useState<Phase>('intro');
  const [questions,    setQuestions]    = useState<GeneratedQuestion[]>([]);
  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [answers,      setAnswers]      = useState<SessionAnswer[]>([]);
  const [typedInput,   setTypedInput]   = useState('');
  const [selectedChoice, setSelected]  = useState<string | null>(null);
  const [feedback,     setFeedback]     = useState<'correct' | 'wrong' | null>(null);
  const [timeLeft,     setTimeLeft]     = useState<number | null>(null);
  const [sessionId,    setSessionId]    = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);

  const inputRef    = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start a new session
  function startSession() {
    const qs = generateSession(template);
    setQuestions(qs);
    setCurrentIdx(0);
    setAnswers([]);
    setTypedInput('');
    setSelected(null);
    setFeedback(null);
    setPhase('playing');
    startTimeRef.current = Date.now();
    if (template.time_limit_secs) setTimeLeft(template.time_limit_secs);
  }

  // Timer tick
  useEffect(() => {
    if (phase !== 'playing' || !template.time_limit_secs) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t === null || t <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, phase]);

  // Focus input on new question
  useEffect(() => {
    if (phase === 'playing' && feedback === null) {
      inputRef.current?.focus();
    }
  }, [currentIdx, phase, feedback]);

  function handleAutoSubmit() {
    submitAnswer('');
  }

  function submitAnswer(answer: string) {
    if (feedback !== null) return;
    const q       = questions[currentIdx];
    const correct = checkAnswer(answer, q.correct_answer);
    const timeMsRaw = Date.now() - startTimeRef.current;

    const newAnswer: SessionAnswer = {
      question_index: currentIdx,
      student_answer: answer,
      correct,
      time_ms: timeMsRaw,
    };

    setFeedback(correct ? 'correct' : 'wrong');
    setAnswers(prev => [...prev, newAnswer]);

    // Auto-advance after a short delay
    setTimeout(() => {
      if (currentIdx + 1 >= questions.length) {
        finishSession([...answers, newAnswer]);
      } else {
        setCurrentIdx(i => i + 1);
        setTypedInput('');
        setSelected(null);
        setFeedback(null);
        startTimeRef.current = Date.now();
        if (template.time_limit_secs) setTimeLeft(template.time_limit_secs);
      }
    }, 1200);
  }

  async function finishSession(finalAnswers: SessionAnswer[]) {
    setPhase('result');
    const score    = finalAnswers.filter(a => a.correct).length;
    const maxScore = questions.length;

    setSaving(true);
    try {
      const { data } = await supabase
        .from('exercise_sessions')
        .insert({
          student_id:   userId,
          template_id:  template.id,
          questions,
          answers:      finalAnswers,
          score,
          max_score:    maxScore,
          completed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      setSessionId(data?.id ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const currentQ = questions[currentIdx];
  const score    = answers.filter(a => a.correct).length;
  const pct      = questions.length ? Math.round((score / questions.length) * 100) : 0;

  // ── INTRO SCREEN ─────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100 animate-slide-up">
          <div className="text-5xl mb-4">🧠</div>
          <h1 className="font-display font-extrabold text-3xl text-gray-900 mb-2">
            {template.title}
          </h1>
          {template.description && (
            <p className="text-gray-500 mb-4 text-sm leading-relaxed">{template.description}</p>
          )}
          <div className="flex justify-center gap-4 text-sm text-gray-500 mb-8">
            <span className="bg-gray-50 rounded-lg px-3 py-1.5">
              📋 {template.questions_count} questions
            </span>
            {template.time_limit_secs && (
              <span className="bg-gray-50 rounded-lg px-3 py-1.5">
                ⏱ {template.time_limit_secs}s each
              </span>
            )}
            <span className="bg-gray-50 rounded-lg px-3 py-1.5 capitalize">
              {difficultyEmoji(template.difficulty)} {template.difficulty}
            </span>
          </div>
          <button
            onClick={startSession}
            className="w-full py-4 rounded-2xl bg-brand-500 text-white font-display font-bold text-xl hover:bg-brand-600 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            Let's go! 🚀
          </button>
          <button
            onClick={() => router.back()}
            className="mt-3 w-full py-3 rounded-2xl text-gray-500 hover:text-gray-700 font-semibold text-sm transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ── RESULTS SCREEN ───────────────────────────────────────────────
  if (phase === 'result') {
    const emoji = pct === 100 ? '🌟' : pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪';
    const msg   = pct === 100
      ? 'Perfect score! You\'re a star!'
      : pct >= 80 ? 'Excellent work!'
      : pct >= 60 ? 'Good effort! Keep practising.'
      : 'Keep going — practice makes perfect!';

    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100 animate-slide-up">
          <div className="text-6xl mb-4">{emoji}</div>
          <h1 className="font-display font-extrabold text-4xl text-gray-900 mb-1">
            {pct}%
          </h1>
          <p className="text-gray-500 mb-1">
            {score} / {questions.length} correct
          </p>
          <p className="font-display font-semibold text-lg text-brand-600 mb-6">{msg}</p>

          {/* Score bar */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-8">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? '#22c55e' : pct >= 60 ? '#0ea5e9' : '#f97316',
              }}
            />
          </div>

          {/* Question review */}
          <div className="space-y-2 mb-8 text-left max-h-48 overflow-y-auto pr-1">
            {questions.map((q, i) => {
              const a = answers[i];
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-xl px-3 py-2 text-sm ${
                    a?.correct ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <span className="mt-0.5 text-base">{a?.correct ? '✅' : '❌'}</span>
                  <div>
                    <p className="text-gray-700 font-medium">{q.question_text}</p>
                    {!a?.correct && (
                      <p className="text-gray-400 text-xs mt-0.5">
                        Your answer: <span className="text-red-500">{a?.student_answer || '—'}</span>{' '}
                        · Correct: <span className="text-green-600">{q.correct_answer}</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={startSession}
              className="w-full py-4 rounded-2xl bg-brand-500 text-white font-display font-bold text-lg hover:bg-brand-600 transition-all shadow-md"
            >
              Try again 🔄
            </button>
            <button
              onClick={() => router.push('/student/dashboard')}
              className="w-full py-3 rounded-2xl text-gray-500 hover:text-gray-700 font-semibold text-sm transition-colors"
            >
              ← Back to exercises
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PLAYING SCREEN ───────────────────────────────────────────────
  const progressPct = Math.round((currentIdx / questions.length) * 100);

  return (
    <div className="flex flex-col items-center min-h-[80vh] px-4 py-6 max-w-xl mx-auto w-full">
      {/* Progress bar + counter */}
      <div className="w-full mb-6">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
          <span>Question {currentIdx + 1} of {questions.length}</span>
          <div className="flex items-center gap-3">
            <span>✅ {score}</span>
            {timeLeft !== null && (
              <span className={`font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-gray-600'}`}>
                ⏱ {timeLeft}s
              </span>
            )}
          </div>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-400 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div
        key={currentIdx}
        className={`w-full bg-white rounded-3xl shadow-lg border-2 p-8 mb-6 text-center transition-all animate-slide-up ${
          feedback === 'correct' ? 'border-green-400 bg-green-50'
          : feedback === 'wrong' ? 'border-red-400 bg-red-50'
          : 'border-gray-100'
        }`}
      >
        <p className="font-display font-bold text-2xl md:text-3xl text-gray-900 leading-tight">
          {currentQ.question_text}
        </p>

        {feedback && (
          <div className={`mt-4 text-2xl font-display font-bold ${feedback === 'correct' ? 'text-green-600' : 'text-red-500'}`}>
            {feedback === 'correct' ? '✅ Correct!' : `❌ The answer was ${currentQ.correct_answer}`}
          </div>
        )}
      </div>

      {/* Answer area */}
      {currentQ.answer_type === 'multiple_choice' && currentQ.choices ? (
        <div className="w-full grid grid-cols-2 gap-3">
          {currentQ.choices.map(choice => (
            <button
              key={choice}
              disabled={feedback !== null}
              onClick={() => {
                setSelected(choice);
                submitAnswer(choice);
              }}
              className={`py-4 rounded-2xl font-display font-bold text-xl border-2 transition-all ${
                feedback !== null && choice === currentQ.correct_answer
                  ? 'border-green-400 bg-green-100 text-green-700'
                  : feedback !== null && choice === selectedChoice && choice !== currentQ.correct_answer
                  ? 'border-red-400 bg-red-100 text-red-600'
                  : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50 text-gray-800'
              }`}
            >
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <form
          onSubmit={e => { e.preventDefault(); submitAnswer(typedInput); }}
          className="w-full flex gap-3"
        >
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={typedInput}
            onChange={e => setTypedInput(e.target.value)}
            disabled={feedback !== null}
            placeholder="Type your answer…"
            className="flex-1 px-5 py-4 rounded-2xl border-2 border-gray-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-xl font-display font-bold text-center text-gray-900 disabled:opacity-50 transition"
          />
          <button
            type="submit"
            disabled={feedback !== null || typedInput.trim() === ''}
            className="px-6 py-4 rounded-2xl bg-brand-500 text-white font-display font-bold text-xl disabled:opacity-40 hover:bg-brand-600 transition-all shadow-md"
          >
            ✓
          </button>
        </form>
      )}

      {/* Hint */}
      {currentQ.hint && feedback === null && (
        <p className="mt-4 text-sm text-gray-400 text-center">
          💡 Hint: {currentQ.hint}
        </p>
      )}
    </div>
  );
}

function difficultyEmoji(d: string) {
  return d === 'easy' ? '🟢' : d === 'medium' ? '🟡' : '🔴';
}
