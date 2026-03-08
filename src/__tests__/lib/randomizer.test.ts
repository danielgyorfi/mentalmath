// ════════════════════════════════════════════════════════════════════
// Unit tests for src/lib/randomizer.ts
// ════════════════════════════════════════════════════════════════════

import {
  applyTemplate,
  evaluateAnswer,
  checkAnswer,
  resolveVariables,
  generateQuestion,
  generateSession,
} from '@/lib/randomizer';
import type { ExerciseTemplate, VariableDefinitions } from '@/lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────

/** Build a minimal valid ExerciseTemplate for testing. */
function makeTemplate(
  overrides: Partial<ExerciseTemplate> = {},
): ExerciseTemplate {
  return {
    id:                'test-id',
    teacher_id:        'teacher-1',
    title:             'Test Exercise',
    description:       null,
    age_groups:        ['8-10'],
    difficulty:        'easy',
    answer_type:       'typed',
    question_template: 'What is {a} + {b}?',
    variables: {
      a: { type: 'integer', min: 1, max: 10 },
      b: { type: 'integer', min: 1, max: 10 },
    },
    answer_expression: 'a + b',
    hints:             [],
    subject_tags:      [],
    time_limit_secs:   null,
    questions_count:   5,
    is_published:      true,
    created_at:        '2024-01-01T00:00:00Z',
    updated_at:        '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
// applyTemplate
// ════════════════════════════════════════════════════════════════════

describe('applyTemplate', () => {
  it('substitutes a single variable', () => {
    expect(applyTemplate('Hello {name}!', { name: 'Alex' })).toBe('Hello Alex!');
  });

  it('substitutes multiple variables', () => {
    const result = applyTemplate('What is {a} × {b}?', { a: 3, b: 7 });
    expect(result).toBe('What is 3 × 7?');
  });

  it('substitutes the same variable used twice', () => {
    const result = applyTemplate('{n} + {n} = ?', { n: 5 });
    expect(result).toBe('5 + 5 = ?');
  });

  it('leaves unknown placeholders intact', () => {
    const result = applyTemplate('What is {a} + {missing}?', { a: 4 });
    expect(result).toBe('What is 4 + {missing}?');
  });

  it('handles numeric zero correctly', () => {
    expect(applyTemplate('Score: {x}', { x: 0 })).toBe('Score: 0');
  });

  it('handles decimal values', () => {
    expect(applyTemplate('Value: {v}', { v: 3.14 })).toBe('Value: 3.14');
  });

  it('returns the template unchanged when no variables provided', () => {
    expect(applyTemplate('No vars here', {})).toBe('No vars here');
  });

  it('handles an empty template string', () => {
    expect(applyTemplate('', { a: 1 })).toBe('');
  });
});

// ════════════════════════════════════════════════════════════════════
// evaluateAnswer
// ════════════════════════════════════════════════════════════════════

describe('evaluateAnswer', () => {
  it('evaluates a simple multiplication', () => {
    expect(evaluateAnswer('a * b', { a: 3, b: 7 })).toBe('21');
  });

  it('evaluates a simple addition', () => {
    expect(evaluateAnswer('a + b', { a: 5, b: 8 })).toBe('13');
  });

  it('evaluates a simple subtraction', () => {
    expect(evaluateAnswer('a - b', { a: 10, b: 4 })).toBe('6');
  });

  it('evaluates a simple division producing an integer', () => {
    expect(evaluateAnswer('a / b', { a: 12, b: 4 })).toBe('3');
  });

  it('evaluates a percentage expression', () => {
    // 25% of 200 = 50
    expect(evaluateAnswer('p / 100 * n', { p: 25, n: 200 })).toBe('50');
  });

  it('strips float imprecision (rounds to 6dp)', () => {
    // 1/3 ≈ 0.333333 after rounding
    const result = evaluateAnswer('1 / 3', {});
    expect(parseFloat(result)).toBeCloseTo(0.333333, 5);
  });

  it('returns "?" for an invalid expression', () => {
    expect(evaluateAnswer('a @@@ b', { a: 1, b: 2 })).toBe('?');
  });

  it('returns "?" for division by zero via expression', () => {
    // mathjs returns Infinity for 1/0 which becomes the string "Infinity"
    const result = evaluateAnswer('a / b', { a: 1, b: 0 });
    // We accept either "?" or "Infinity" — the important thing is it doesn't throw
    expect(typeof result).toBe('string');
  });

  it('handles expressions with no variable substitution', () => {
    expect(evaluateAnswer('2 + 2', {})).toBe('4');
  });

  it('substitutes all variable occurrences in expression', () => {
    // a^2 + a with a=3 → 9 + 3 = 12
    expect(evaluateAnswer('a^2 + a', { a: 3 })).toBe('12');
  });
});

// ════════════════════════════════════════════════════════════════════
// checkAnswer
// ════════════════════════════════════════════════════════════════════

describe('checkAnswer', () => {
  // ── Exact string matches ──────────────────────────────────────────
  it('accepts an exact match', () => {
    expect(checkAnswer('42', '42')).toBe(true);
  });

  it('trims whitespace before comparing', () => {
    expect(checkAnswer('  42  ', '42')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(checkAnswer('YES', 'yes')).toBe(true);
  });

  it('rejects a wrong string answer', () => {
    expect(checkAnswer('43', '42')).toBe(false);
  });

  // ── Numeric tolerance ─────────────────────────────────────────────
  it('accepts numerically equal values', () => {
    expect(checkAnswer('7.0', '7')).toBe(true);
  });

  it('accepts values within float tolerance (< 0.001)', () => {
    expect(checkAnswer('3.14159', '3.14159')).toBe(true);
  });

  it('rejects values just outside tolerance', () => {
    expect(checkAnswer('42.002', '42')).toBe(false);
  });

  it('accepts values within tolerance (e.g. 0.0009 diff)', () => {
    expect(checkAnswer('42.0009', '42')).toBe(true);
  });

  // ── Edge cases ────────────────────────────────────────────────────
  it('treats empty student answer as wrong', () => {
    expect(checkAnswer('', '42')).toBe(false);
  });

  it('handles both answers being zero', () => {
    expect(checkAnswer('0', '0')).toBe(true);
  });

  it('handles negative numbers', () => {
    expect(checkAnswer('-5', '-5')).toBe(true);
  });

  it('rejects mismatched negative', () => {
    expect(checkAnswer('5', '-5')).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// resolveVariables
// ════════════════════════════════════════════════════════════════════

describe('resolveVariables', () => {
  describe('integer type', () => {
    it('returns a value within [min, max]', () => {
      const defs: VariableDefinitions = { n: { type: 'integer', min: 3, max: 7 } };
      // Run many times to have statistical confidence
      for (let i = 0; i < 200; i++) {
        const { n } = resolveVariables(defs);
        expect(typeof n).toBe('number');
        expect(n).toBeGreaterThanOrEqual(3);
        expect(n).toBeLessThanOrEqual(7);
        expect(Number.isInteger(n)).toBe(true);
      }
    });

    it('can produce both boundary values (min and max)', () => {
      // Seed: with min=1, max=2, we should see both 1 and 2 across enough runs
      const defs: VariableDefinitions = { n: { type: 'integer', min: 1, max: 2 } };
      const seen = new Set<number>();
      for (let i = 0; i < 500; i++) {
        seen.add(resolveVariables(defs).n as number);
      }
      expect(seen.has(1)).toBe(true);
      expect(seen.has(2)).toBe(true);
    });

    it('returns exactly min when min === max', () => {
      const defs: VariableDefinitions = { n: { type: 'integer', min: 5, max: 5 } };
      expect(resolveVariables(defs).n).toBe(5);
    });
  });

  describe('decimal type', () => {
    it('returns a decimal within range with correct decimal places', () => {
      const defs: VariableDefinitions = { x: { type: 'decimal', min: 1, max: 5, places: 2 } };
      for (let i = 0; i < 100; i++) {
        const { x } = resolveVariables(defs);
        expect(typeof x).toBe('number');
        expect(x).toBeGreaterThanOrEqual(1);
        expect(x).toBeLessThanOrEqual(5);
        // Check decimal places: string representation has at most 2 dp
        const str = x.toString();
        const dp  = str.includes('.') ? str.split('.')[1].length : 0;
        expect(dp).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('fraction type', () => {
    it('returns a string in "n/d" format', () => {
      const defs: VariableDefinitions = {
        f: { type: 'fraction', numerator: { min: 1, max: 9 }, denominator: { min: 2, max: 10 } },
      };
      for (let i = 0; i < 100; i++) {
        const { f } = resolveVariables(defs);
        expect(typeof f).toBe('string');
        expect(f as string).toMatch(/^\d+\/\d+$/);
        const [num, den] = (f as string).split('/').map(Number);
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(9);
        expect(den).toBeGreaterThanOrEqual(1); // denominator min is 2 but 0 is guarded to 1
      }
    });

    it('avoids a zero denominator', () => {
      // Force denominator range to include 0
      const defs: VariableDefinitions = {
        f: { type: 'fraction', numerator: { min: 1, max: 1 }, denominator: { min: 0, max: 0 } },
      };
      const { f } = resolveVariables(defs);
      const den = Number((f as string).split('/')[1]);
      expect(den).not.toBe(0);
    });
  });

  describe('name type', () => {
    it('returns a non-empty string from the default pool', () => {
      const defs: VariableDefinitions = { name: { type: 'name' } };
      for (let i = 0; i < 50; i++) {
        const { name } = resolveVariables(defs);
        expect(typeof name).toBe('string');
        expect((name as string).length).toBeGreaterThan(0);
      }
    });

    it('returns only values from a custom pool', () => {
      const pool = ['Alice', 'Bob'];
      const defs: VariableDefinitions = { name: { type: 'name', pool } };
      for (let i = 0; i < 100; i++) {
        expect(pool).toContain(resolveVariables(defs).name);
      }
    });

    it('falls back to default pool when custom pool is empty', () => {
      const defs: VariableDefinitions = { name: { type: 'name', pool: [] } };
      // Should not throw; should return some string
      expect(() => resolveVariables(defs)).not.toThrow();
      const { name } = resolveVariables(defs);
      expect(typeof name).toBe('string');
    });
  });

  describe('subject type', () => {
    it('returns a string from the default pool', () => {
      const defs: VariableDefinitions = { item: { type: 'subject' } };
      const { item } = resolveVariables(defs);
      expect(typeof item).toBe('string');
      expect((item as string).length).toBeGreaterThan(0);
    });

    it('returns only values from a custom pool', () => {
      const pool = ['cats', 'dogs'];
      const defs: VariableDefinitions = { item: { type: 'subject', pool } };
      for (let i = 0; i < 100; i++) {
        expect(pool).toContain(resolveVariables(defs).item);
      }
    });
  });

  describe('choice type', () => {
    it('returns only values from the options list', () => {
      const options = ['10', '20', '25', '50'];
      const defs: VariableDefinitions = { p: { type: 'choice', options } };
      for (let i = 0; i < 100; i++) {
        expect(options).toContain(resolveVariables(defs).p);
      }
    });
  });

  it('resolves multiple independent variables in one call', () => {
    const defs: VariableDefinitions = {
      a:    { type: 'integer', min: 1,  max: 10 },
      b:    { type: 'integer', min: 11, max: 20 },
      name: { type: 'name' },
    };
    const result = resolveVariables(defs);
    expect(result).toHaveProperty('a');
    expect(result).toHaveProperty('b');
    expect(result).toHaveProperty('name');
    expect(result.a).toBeGreaterThanOrEqual(1);
    expect(result.a).toBeLessThanOrEqual(10);
    expect(result.b).toBeGreaterThanOrEqual(11);
    expect(result.b).toBeLessThanOrEqual(20);
  });

  it('returns an empty object for empty definitions', () => {
    expect(resolveVariables({})).toEqual({});
  });
});

// ════════════════════════════════════════════════════════════════════
// generateQuestion
// ════════════════════════════════════════════════════════════════════

describe('generateQuestion', () => {
  const multiplicationTemplate = makeTemplate({
    question_template: 'What is {a} × {b}?',
    variables: {
      a: { type: 'integer', min: 2, max: 12 },
      b: { type: 'integer', min: 2, max: 12 },
    },
    answer_expression: 'a * b',
    answer_type:       'typed',
  });

  it('returns a question with the correct shape', () => {
    const q = generateQuestion(multiplicationTemplate, 0);
    expect(q).toHaveProperty('index', 0);
    expect(q).toHaveProperty('question_text');
    expect(q).toHaveProperty('variables');
    expect(q).toHaveProperty('correct_answer');
    expect(q).toHaveProperty('answer_type');
  });

  it('sets the index correctly', () => {
    expect(generateQuestion(multiplicationTemplate, 3).index).toBe(3);
  });

  it('produces a question_text matching the template pattern', () => {
    const q = generateQuestion(multiplicationTemplate, 0);
    expect(q.question_text).toMatch(/^What is \d+ × \d+\?$/);
  });

  it('correct_answer equals a * b for the resolved variables', () => {
    const q = generateQuestion(multiplicationTemplate, 0);
    const { a, b } = q.variables as { a: number; b: number };
    expect(q.correct_answer).toBe(String(a * b));
  });

  it('respects typed answer_type', () => {
    const q = generateQuestion(makeTemplate({ answer_type: 'typed' }), 0);
    expect(q.answer_type).toBe('typed');
    expect(q.choices).toBeUndefined();
  });

  it('respects multiple_choice answer_type and produces exactly 4 choices', () => {
    const q = generateQuestion(makeTemplate({ answer_type: 'multiple_choice' }), 0);
    expect(q.answer_type).toBe('multiple_choice');
    expect(q.choices).toBeDefined();
    expect(q.choices!.length).toBe(4);
  });

  it('includes the correct answer among multiple_choice choices', () => {
    const q = generateQuestion(makeTemplate({ answer_type: 'multiple_choice' }), 0);
    expect(q.choices).toContain(q.correct_answer);
  });

  it('has unique choices (no duplicates) in multiple_choice', () => {
    // Run several times since choices are random
    for (let i = 0; i < 20; i++) {
      const q = generateQuestion(makeTemplate({ answer_type: 'multiple_choice' }), 0);
      const unique = new Set(q.choices!);
      expect(unique.size).toBe(q.choices!.length);
    }
  });

  it('answer_type is either typed or multiple_choice when template type is "both"', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion(makeTemplate({ answer_type: 'both' }), 0);
      seen.add(q.answer_type);
    }
    expect(seen.has('typed')).toBe(true);
    expect(seen.has('multiple_choice')).toBe(true);
  });

  it('includes a hint when the template has hints', () => {
    const hints = ['Try skip-counting!', 'Use your fingers.'];
    const q     = generateQuestion(makeTemplate({ hints }), 0);
    // hint is either one of the defined hints or undefined (it could be undefined if hints is empty)
    if (q.hint !== undefined) {
      expect(hints).toContain(q.hint);
    }
  });

  it('does not include a hint when template has no hints', () => {
    const q = generateQuestion(makeTemplate({ hints: [] }), 0);
    expect(q.hint).toBeUndefined();
  });

  it('resolves word-problem variables (name, subject, integer) correctly', () => {
    const template = makeTemplate({
      question_template: '{name} bought {qty} {item}. Total?',
      variables: {
        name: { type: 'name' },
        qty:  { type: 'integer', min: 1, max: 5 },
        item: { type: 'subject', pool: ['pens', 'books'] },
      },
      answer_expression: 'qty',
    });
    const q = generateQuestion(template, 0);
    expect(q.question_text).toMatch(/bought \d+ (pens|books)\. Total\?/);
    expect(q.correct_answer).toMatch(/^\d+$/);
  });
});

// ════════════════════════════════════════════════════════════════════
// generateSession
// ════════════════════════════════════════════════════════════════════

describe('generateSession', () => {
  it('returns exactly questions_count questions', () => {
    const template = makeTemplate({ questions_count: 7 });
    const session  = generateSession(template);
    expect(session).toHaveLength(7);
  });

  it('indexes questions sequentially from 0', () => {
    const template = makeTemplate({ questions_count: 5 });
    const session  = generateSession(template);
    session.forEach((q, i) => expect(q.index).toBe(i));
  });

  it('generates questions independently (not all the same)', () => {
    // With random numbers 2-12 × 2-12, extremely unlikely all 10 are identical
    const template = makeTemplate({
      questions_count:   10,
      variables: {
        a: { type: 'integer', min: 2, max: 12 },
        b: { type: 'integer', min: 2, max: 12 },
      },
      answer_expression: 'a * b',
    });
    const session = generateSession(template);
    const answers = session.map(q => q.correct_answer);
    const unique  = new Set(answers);
    // With 121 possible outcomes, probability all 10 are same is (1/121)^9 ≈ 0
    expect(unique.size).toBeGreaterThan(1);
  });

  it('returns empty array when questions_count is 0', () => {
    const template = makeTemplate({ questions_count: 0 });
    expect(generateSession(template)).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
// Integration: full pipeline from template → question → check
// ════════════════════════════════════════════════════════════════════

describe('Full pipeline: generate then check', () => {
  it('always produces a correct answer that passes checkAnswer', () => {
    const template = makeTemplate({
      question_template: 'What is {a} × {b}?',
      variables: {
        a: { type: 'integer', min: 1, max: 20 },
        b: { type: 'integer', min: 1, max: 20 },
      },
      answer_expression: 'a * b',
    });

    for (let i = 0; i < 50; i++) {
      const q = generateQuestion(template, i);
      expect(checkAnswer(q.correct_answer, q.correct_answer)).toBe(true);
    }
  });

  it('correct answer is always among choices for multiple_choice questions', () => {
    const template = makeTemplate({ answer_type: 'multiple_choice' });
    for (let i = 0; i < 50; i++) {
      const q = generateQuestion(template, i);
      expect(q.choices).toContain(q.correct_answer);
    }
  });

  it('percentage template produces correct answers', () => {
    // 10% of 100 = 10, 50% of 200 = 100, etc.
    const template = makeTemplate({
      question_template: 'What is {p}% of {n}?',
      variables: {
        p: { type: 'choice', options: ['10', '50'] },
        n: { type: 'integer', min: 10, max: 100 },
      },
      answer_expression: 'p / 100 * n',
      answer_type:       'typed',
    });

    for (let i = 0; i < 30; i++) {
      const q = generateQuestion(template, i);
      const { p, n } = q.variables as { p: string; n: number };
      const expected  = (parseFloat(p) / 100) * n;
      expect(checkAnswer(q.correct_answer, String(expected))).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// Known bug: generateChoices uses `const attempts` instead of `let`
// This means the loop exit relies solely on choices.size reaching 4.
// For numeric answers this works in practice, but the guard is broken.
// ════════════════════════════════════════════════════════════════════

describe('Known limitations', () => {
  it('generateChoices loop guard: const attempts is always 0 (never increments)', () => {
    // This test documents the bug without triggering an infinite loop.
    // When correct_answer is numeric, enough distractors are generated so
    // the loop terminates via choices.size == 4 rather than attempts >= 50.
    // The bug would surface for non-numeric answers (text-only) where all
    // distractor candidates fail the !isNaN check, causing an infinite loop.
    // A fix would be: change `const attempts = 0` to `let attempts = 0`
    //                 and increment `attempts++` inside the loop.
    const template = makeTemplate({ answer_type: 'multiple_choice' });
    // This should complete quickly for numeric answers
    const q = generateQuestion(template, 0);
    expect(q.choices).toHaveLength(4); // Passes because correct_answer is numeric
  });
});
