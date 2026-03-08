'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { generateQuestion } from '@/lib/randomizer';
import type {
  ExerciseTemplate, AgeGroup, DifficultyLevel, AnswerType,
  VariableDefinitions, VariableDefinition,
} from '@/lib/types';
import { EXAMPLE_TEMPLATES } from '@/lib/randomizer';

interface Props {
  teacherId: string;
  existing?: ExerciseTemplate;
}

const BLANK: Omit<ExerciseTemplate, 'id' | 'teacher_id' | 'created_at' | 'updated_at'> = {
  title:             '',
  description:       '',
  age_groups:        ['8-10'],
  difficulty:        'medium',
  answer_type:       'typed',
  question_template: 'What is {a} × {b}?',
  variables: {
    a: { type: 'integer', min: 2, max: 12 },
    b: { type: 'integer', min: 2, max: 12 },
  },
  answer_expression: 'a * b',
  hints:             [],
  subject_tags:      [],
  time_limit_secs:   null,
  questions_count:   10,
  is_published:      false,
};

export default function ExerciseEditor({ teacherId, existing }: Props) {
  const router   = useRouter();
  const supabase = createClient();
  const isEdit   = !!existing;

  const [form,     setForm]     = useState(existing ? {
    ...existing,
    description: existing.description ?? '',
  } : { ...BLANK });
  const [varJson,  setVarJson]  = useState(
    JSON.stringify(existing?.variables ?? BLANK.variables, null, 2),
  );
  const [varError, setVarError] = useState<string | null>(null);
  const [preview,  setPreview]  = useState<ReturnType<typeof generateQuestion> | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [hintInput, setHintInput] = useState('');

  // Sync varJson → form.variables
  function handleVarJsonChange(val: string) {
    setVarJson(val);
    try {
      const parsed = JSON.parse(val);
      setForm(f => ({ ...f, variables: parsed }));
      setVarError(null);
    } catch {
      setVarError('Invalid JSON — fix before saving');
    }
  }

  // Load example template
  function loadExample(idx: number) {
    const ex = EXAMPLE_TEMPLATES[idx];
    if (!ex) return;
    const merged = { ...BLANK, ...ex };
    setForm(merged as typeof form);
    setVarJson(JSON.stringify(ex.variables, null, 2));
    setVarError(null);
    setPreview(null);
    toast.success('Example loaded!');
  }

  // Generate a preview question
  function handlePreview() {
    try {
      const q = generateQuestion(form as ExerciseTemplate, 0);
      setPreview(q);
    } catch (err: any) {
      toast.error('Preview failed: ' + err.message);
    }
  }

  // Add hint
  function addHint() {
    if (!hintInput.trim()) return;
    setForm(f => ({ ...f, hints: [...f.hints, hintInput.trim()] }));
    setHintInput('');
  }

  // Toggle age group
  function toggleAgeGroup(ag: AgeGroup) {
    setForm(f => ({
      ...f,
      age_groups: f.age_groups.includes(ag)
        ? f.age_groups.filter(a => a !== ag)
        : [...f.age_groups, ag],
    }));
  }

  // Save
  async function handleSave(publish: boolean) {
    if (varError) { toast.error('Fix the variables JSON first'); return; }
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.question_template.trim()) { toast.error('Question template is required'); return; }
    if (!form.answer_expression.trim()) { toast.error('Answer expression is required'); return; }
    if (form.age_groups.length === 0) { toast.error('Select at least one age group'); return; }

    setLoading(true);
    const payload = { ...form, teacher_id: teacherId, is_published: publish };

    const { error } = isEdit
      ? await supabase.from('exercise_templates').update(payload).eq('id', existing!.id)
      : await supabase.from('exercise_templates').insert(payload);

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success(publish ? 'Exercise published! 🎉' : 'Draft saved ✅');
    router.push('/teacher/exercises');
    router.refresh();
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-extrabold text-2xl text-gray-900">
          {isEdit ? 'Edit exercise' : 'New exercise'}
        </h1>
        {!isEdit && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Load example:</span>
            {EXAMPLE_TEMPLATES.map((ex, i) => (
              <button
                key={i}
                onClick={() => loadExample(i)}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-600 font-medium transition-colors"
              >
                {ex.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Basic info */}
        <Card title="Basic info">
          <Field label="Title *">
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Times Tables"
              className={inputClass}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="A short description for students"
              rows={2}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Difficulty">
              <select
                value={form.difficulty}
                onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as DifficultyLevel }))}
                className={inputClass}
              >
                <option value="easy">🟢 Easy</option>
                <option value="medium">🟡 Medium</option>
                <option value="hard">🔴 Hard</option>
              </select>
            </Field>
            <Field label="Answer type">
              <select
                value={form.answer_type}
                onChange={e => setForm(f => ({ ...f, answer_type: e.target.value as AnswerType }))}
                className={inputClass}
              >
                <option value="typed">⌨️ Typed answer</option>
                <option value="multiple_choice">🔘 Multiple choice</option>
                <option value="both">🎲 Both (random)</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Questions per session">
              <input
                type="number"
                min={1}
                max={50}
                value={form.questions_count}
                onChange={e => setForm(f => ({ ...f, questions_count: parseInt(e.target.value) || 10 }))}
                className={inputClass}
              />
            </Field>
            <Field label="Time per question (s, leave blank for untimed)">
              <input
                type="number"
                min={5}
                max={300}
                value={form.time_limit_secs ?? ''}
                onChange={e => setForm(f => ({
                  ...f,
                  time_limit_secs: e.target.value ? parseInt(e.target.value) : null,
                }))}
                placeholder="Untimed"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Age groups">
            <div className="flex gap-3">
              {(['8-10', '11-13'] as AgeGroup[]).map(ag => (
                <button
                  key={ag}
                  type="button"
                  onClick={() => toggleAgeGroup(ag)}
                  className={`px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all ${
                    form.age_groups.includes(ag)
                      ? 'border-brand-400 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {ag}
                </button>
              ))}
            </div>
          </Field>
        </Card>

        {/* Question template */}
        <Card title="Question template">
          <p className="text-sm text-gray-500 mb-3">
            Use <code className="bg-gray-100 px-1.5 py-0.5 rounded text-brand-700">{'{a}'}</code> for variables.
            Variable names must match keys in the Variables section below.
          </p>
          <Field label="Question template *">
            <input
              value={form.question_template}
              onChange={e => setForm(f => ({ ...f, question_template: e.target.value }))}
              placeholder="What is {a} × {b}?"
              className={`${inputClass} font-mono`}
            />
          </Field>
          <Field label="Answer expression * (evaluated by mathjs)">
            <input
              value={form.answer_expression}
              onChange={e => setForm(f => ({ ...f, answer_expression: e.target.value }))}
              placeholder="a * b"
              className={`${inputClass} font-mono`}
            />
          </Field>
          <p className="text-xs text-gray-400 mt-1">
            Examples: <code>a * b</code> · <code>a + b - c</code> · <code>round(p / 100 * n, 2)</code>
          </p>
        </Card>

        {/* Variables JSON */}
        <Card title="Variables (JSON)">
          <p className="text-sm text-gray-500 mb-3">
            Define each variable used in your template. Supported types:
            <strong> integer</strong>, <strong>decimal</strong>, <strong>fraction</strong>,{' '}
            <strong>name</strong>, <strong>subject</strong>, <strong>choice</strong>.
          </p>
          <textarea
            value={varJson}
            onChange={e => handleVarJsonChange(e.target.value)}
            rows={10}
            spellCheck={false}
            className={`${inputClass} font-mono text-sm ${varError ? 'border-red-400' : ''}`}
          />
          {varError && <p className="text-red-500 text-xs mt-1">{varError}</p>}

          {/* Variable reference */}
          <details className="mt-3">
            <summary className="text-xs text-brand-600 cursor-pointer font-semibold hover:underline">
              📖 Variable type reference
            </summary>
            <pre className="mt-2 text-xs bg-gray-50 rounded-xl p-4 overflow-x-auto text-gray-600 leading-relaxed">
{`// Integer: random whole number
"a": { "type": "integer", "min": 2, "max": 12 }

// Decimal: random decimal
"x": { "type": "decimal", "min": 1.0, "max": 10.0, "places": 2 }

// Fraction: displayed as "n/d"
"f": { "type": "fraction",
       "numerator": { "min": 1, "max": 9 },
       "denominator": { "min": 2, "max": 10 } }

// Name: random first name from built-in pool
"name": { "type": "name" }
// Or custom pool:
"name": { "type": "name", "pool": ["Alice", "Bob", "Cara"] }

// Subject: random everyday object
"item": { "type": "subject" }
// Or custom:
"item": { "type": "subject", "pool": ["cats", "dogs", "fish"] }

// Choice: pick from a list
"p": { "type": "choice", "options": ["10", "20", "25", "50"] }`}
            </pre>
          </details>
        </Card>

        {/* Hints */}
        <Card title="Hints (optional)">
          <p className="text-sm text-gray-500 mb-3">
            Add hints that are shown randomly during a question.
          </p>
          <div className="flex gap-2 mb-3">
            <input
              value={hintInput}
              onChange={e => setHintInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addHint()}
              placeholder="Type a hint and press Enter"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={addHint}
              className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 font-semibold hover:bg-brand-50 hover:text-brand-600 transition-colors"
            >
              Add
            </button>
          </div>
          {form.hints.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.hints.map((h, i) => (
                <span
                  key={i}
                  className="bg-brand-50 text-brand-700 text-sm rounded-lg px-3 py-1.5 flex items-center gap-1.5"
                >
                  💡 {h}
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, hints: f.hints.filter((_, j) => j !== i) }))}
                    className="text-brand-400 hover:text-brand-700 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* Preview */}
        <Card title="Preview">
          <button
            type="button"
            onClick={handlePreview}
            className="px-4 py-2 rounded-xl bg-accent-50 text-accent-700 font-semibold text-sm hover:bg-accent-100 transition-colors"
          >
            🎲 Generate preview question
          </button>

          {preview && (
            <div className="mt-4 bg-white rounded-xl border-2 border-brand-200 p-5 animate-slide-up">
              <p className="font-display font-bold text-xl text-gray-900 mb-3">
                {preview.question_text}
              </p>
              {preview.answer_type === 'multiple_choice' && preview.choices && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {preview.choices.map(c => (
                    <span
                      key={c}
                      className={`text-center py-2 rounded-lg border text-sm font-semibold ${
                        c === preview.correct_answer
                          ? 'border-green-400 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {c} {c === preview.correct_answer ? '✅' : ''}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-sm text-gray-500">
                Correct answer: <span className="font-bold text-green-600">{preview.correct_answer}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Variables: {JSON.stringify(preview.variables)}
              </p>
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <button
            onClick={() => handleSave(false)}
            disabled={loading || !!varError}
            className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 text-gray-700 font-display font-bold text-base hover:border-brand-300 hover:text-brand-600 disabled:opacity-40 transition-all"
          >
            {loading ? '⏳ Saving…' : '💾 Save as draft'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={loading || !!varError}
            className="flex-1 py-3.5 rounded-xl bg-brand-500 text-white font-display font-bold text-base hover:bg-brand-600 disabled:opacity-40 transition-all shadow-md"
          >
            {loading ? '⏳ Publishing…' : '🚀 Publish exercise'}
          </button>
        </div>
      </div>
    </main>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-display font-bold text-lg text-gray-900 mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition text-gray-900 placeholder:text-gray-400 text-sm';
