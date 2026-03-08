// ════════════════════════════════════════════════════════════════════
// MentalMath – Randomization Engine
// Turns an ExerciseTemplate into rendered GeneratedQuestion objects.
// Uses mathjs for safe expression evaluation.
// ════════════════════════════════════════════════════════════════════

import { evaluate } from 'mathjs';
import type {
  ExerciseTemplate,
  VariableDefinition,
  VariableDefinitions,
  ResolvedVariables,
  GeneratedQuestion,
  AnswerType,
} from './types';

// ─── Built-in name pool ─────────────────────────────────────────────
const DEFAULT_NAMES = [
  'Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie',
  'Avery', 'Quinn', 'Blake', 'Drew', 'Skyler', 'Cameron', 'Reese', 'Finley',
  'Logan', 'Parker', 'Hayden', 'Emerson', 'Peyton', 'Rowan', 'Sage', 'River',
];

// ─── Built-in subject pool ──────────────────────────────────────────
const DEFAULT_SUBJECTS = [
  'apples', 'oranges', 'bananas', 'grapes', 'cookies', 'pencils',
  'stickers', 'marbles', 'books', 'cards', 'balls', 'coins',
  'flowers', 'stamps', 'buttons', 'sweets',
];

// ─── Helper: random integer in [min, max] ──────────────────────────
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Helper: random item from an array ─────────────────────────────
function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Resolve one variable ───────────────────────────────────────────
function resolveVariable(def: VariableDefinition): number | string {
  switch (def.type) {
    case 'integer':
      return randInt(def.min, def.max);

    case 'decimal': {
      const raw = Math.random() * (def.max - def.min) + def.min;
      return parseFloat(raw.toFixed(def.places));
    }

    case 'fraction': {
      const n = randInt(def.numerator.min, def.numerator.max);
      const d = randInt(def.denominator.min, def.denominator.max);
      // Avoid 0 denominator
      return `${n}/${d === 0 ? 1 : d}`;
    }

    case 'name':
      return randItem(def.pool && def.pool.length ? def.pool : DEFAULT_NAMES);

    case 'subject':
      return randItem(def.pool && def.pool.length ? def.pool : DEFAULT_SUBJECTS);

    case 'choice':
      return randItem(def.options);

    default:
      return 0;
  }
}

// ─── Resolve all variables for one question ─────────────────────────
export function resolveVariables(defs: VariableDefinitions): ResolvedVariables {
  const result: ResolvedVariables = {};
  for (const [key, def] of Object.entries(defs)) {
    result[key] = resolveVariable(def);
  }
  return result;
}

// ─── Substitute {placeholders} in a template string ─────────────────
export function applyTemplate(template: string, vars: ResolvedVariables): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

// ─── Evaluate the answer expression safely via mathjs ───────────────
export function evaluateAnswer(expression: string, vars: ResolvedVariables): string {
  try {
    // Substitute variables into expression
    const expr = Object.entries(vars).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`\\b${k}\\b`, 'g'), String(v)),
      expression,
    );
    const result = evaluate(expr);

    // Return as a clean string (handle fractions etc)
    if (typeof result === 'number') {
      // Avoid float imprecision: round to 6 decimal places then strip trailing zeros
      return parseFloat(result.toFixed(6)).toString();
    }
    return String(result);
  } catch {
    return '?';
  }
}

// ─── Generate multiple-choice distractors ───────────────────────────
function generateChoices(correct: string, vars: ResolvedVariables): string[] {
  const correctNum = parseFloat(correct);
  const isNumber   = !isNaN(correctNum);
  const choices    = new Set<string>([correct]);

  const attempts = 0;
  while (choices.size < 4 && attempts < 50) {
    let distractor: string;

    if (isNumber) {
      // Strategy: off-by small amount, multiply/divide by small factor
      const strategies = [
        () => (correctNum + randInt(1, 3)).toString(),
        () => (correctNum - randInt(1, 3)).toString(),
        () => (correctNum + randInt(5, 10)).toString(),
        () => (correctNum * randInt(2, 3)).toString(),
        () => Math.max(0, correctNum - randInt(5, 10)).toString(),
      ];
      distractor = randItem(strategies)();
      distractor = parseFloat(parseFloat(distractor).toFixed(6)).toString();
    } else {
      // For text answers, just add numeric suffixes
      distractor = `${correct}-${randInt(1, 9)}`;
    }

    if (distractor !== correct && !isNaN(parseFloat(distractor))) {
      choices.add(distractor);
    }
  }

  // Shuffle
  return Array.from(choices).sort(() => Math.random() - 0.5);
}

// ─── Determine effective answer type ────────────────────────────────
function effectiveAnswerType(templateType: AnswerType): 'typed' | 'multiple_choice' {
  if (templateType === 'both') {
    return Math.random() < 0.5 ? 'typed' : 'multiple_choice';
  }
  return templateType;
}

// ─── Generate a single question from a template ─────────────────────
export function generateQuestion(
  template: ExerciseTemplate,
  index: number,
): GeneratedQuestion {
  const vars         = resolveVariables(template.variables);
  const questionText = applyTemplate(template.question_template, vars);
  const correctAnswer = evaluateAnswer(template.answer_expression, vars);
  const ansType       = effectiveAnswerType(template.answer_type);
  const hint          = template.hints.length > 0
    ? randItem(template.hints)
    : undefined;

  const question: GeneratedQuestion = {
    index,
    question_text:  questionText,
    variables:      vars,
    correct_answer: correctAnswer,
    answer_type:    ansType,
    hint,
  };

  if (ansType === 'multiple_choice') {
    question.choices = generateChoices(correctAnswer, vars);
  }

  return question;
}

// ─── Generate a full set of questions for a session ─────────────────
export function generateSession(template: ExerciseTemplate): GeneratedQuestion[] {
  return Array.from({ length: template.questions_count }, (_, i) =>
    generateQuestion(template, i),
  );
}

// ─── Check if a student answer is correct ───────────────────────────
export function checkAnswer(
  studentAnswer: string,
  correctAnswer: string,
): boolean {
  const s = studentAnswer.trim().toLowerCase();
  const c = correctAnswer.trim().toLowerCase();

  if (s === c) return true;

  // Numeric comparison with tolerance for floats
  const sNum = parseFloat(s);
  const cNum = parseFloat(c);
  if (!isNaN(sNum) && !isNaN(cNum)) {
    return Math.abs(sNum - cNum) < 0.001;
  }

  return false;
}

// ─── Example exercise templates (for onboarding / testing) ─────────

export const EXAMPLE_TEMPLATES: Partial<ExerciseTemplate>[] = [
  {
    title:             'Times Tables',
    description:       'Practice multiplication tables from 2 to 12.',
    age_groups:        ['8-10'],
    difficulty:        'easy',
    answer_type:       'both',
    question_template: 'What is {a} × {b}?',
    variables: {
      a: { type: 'integer', min: 2, max: 12 },
      b: { type: 'integer', min: 2, max: 12 },
    },
    answer_expression: 'a * b',
    subject_tags:      ['multiplication'],
    questions_count:   10,
    hints:             ['Try skip-counting!', 'Use your fingers.'],
  },
  {
    title:             'Division Challenge',
    description:       'Divide numbers and find the quotient.',
    age_groups:        ['8-10'],
    difficulty:        'medium',
    answer_type:       'typed',
    question_template: 'What is {a} ÷ {b}?',
    variables: {
      b: { type: 'integer', min: 2, max: 10 },
      // We compute a = b * c to guarantee clean division
      c: { type: 'integer', min: 1, max: 12 },
      a: { type: 'integer', min: 2, max: 120 },
    },
    answer_expression: 'a / b',
    subject_tags:      ['division'],
    questions_count:   10,
  },
  {
    title:             'Percentage Problems',
    description:       'Find percentages of whole numbers.',
    age_groups:        ['11-13'],
    difficulty:        'medium',
    answer_type:       'multiple_choice',
    question_template: 'What is {p}% of {n}?',
    variables: {
      p: { type: 'choice', options: ['10', '20', '25', '50', '75'] },
      n: { type: 'integer', min: 10, max: 200 },
    },
    answer_expression: 'p / 100 * n',
    subject_tags:      ['percentages', 'fractions'],
    questions_count:   8,
  },
  {
    title:             'Word Problems – Shopping',
    description:       'Real-world addition and multiplication word problems.',
    age_groups:        ['8-10', '11-13'],
    difficulty:        'medium',
    answer_type:       'typed',
    question_template:
      '{name} bought {qty} {item} at £{price} each. How much did they spend in total (in £)?',
    variables: {
      name:  { type: 'name' },
      qty:   { type: 'integer', min: 2, max: 10 },
      item:  { type: 'subject', pool: ['pens', 'notebooks', 'rulers', 'erasers', 'pencils'] },
      price: { type: 'integer', min: 1, max: 20 },
    },
    answer_expression: 'qty * price',
    subject_tags:      ['multiplication', 'word-problems'],
    questions_count:   5,
  },
];
