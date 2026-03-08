// ════════════════════════════════════════════════════════════════════
// MentalMath – Shared TypeScript types
// ════════════════════════════════════════════════════════════════════

export type UserRole        = 'student' | 'teacher' | 'admin';
export type AgeGroup        = '8-10' | '11-13';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type AnswerType      = 'typed' | 'multiple_choice' | 'both';

// ─── Database row types ────────────────────────────────────────────

export interface Profile {
  id:         string;
  role:       UserRole;
  full_name:  string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id:         string;
  teacher_id: string;
  name:       string;
  join_code:  string;
  created_at: string;
}

export interface ClassMember {
  class_id:   string;
  student_id: string;
  joined_at:  string;
}

export interface ExerciseTemplate {
  id:                string;
  teacher_id:        string;
  title:             string;
  description:       string | null;
  age_groups:        AgeGroup[];
  difficulty:        DifficultyLevel;
  answer_type:       AnswerType;
  question_template: string;
  variables:         VariableDefinitions;
  answer_expression: string;
  hints:             string[];
  subject_tags:      string[];
  time_limit_secs:   number | null;
  questions_count:   number;
  is_published:      boolean;
  created_at:        string;
  updated_at:        string;
}

export interface ClassExercise {
  class_id:    string;
  template_id: string;
  assigned_at: string;
}

export interface ExerciseSession {
  id:           string;
  student_id:   string;
  template_id:  string;
  questions:    GeneratedQuestion[];
  answers:      SessionAnswer[];
  score:        number | null;
  max_score:    number | null;
  completed_at: string | null;
  started_at:   string;
}

// ─── Variable definitions (used in exercise templates) ─────────────

export type VariableDefinition =
  | IntegerVariable
  | DecimalVariable
  | FractionVariable
  | NameVariable
  | SubjectVariable
  | ChoiceVariable;

export interface IntegerVariable {
  type: 'integer';
  min:  number;
  max:  number;
}

export interface DecimalVariable {
  type:   'decimal';
  min:    number;
  max:    number;
  places: number; // decimal places
}

export interface FractionVariable {
  type:        'fraction';
  numerator:   { min: number; max: number };
  denominator: { min: number; max: number };
}

export interface NameVariable {
  type: 'name';
  pool?: string[]; // custom pool, or uses default list
}

export interface SubjectVariable {
  type: 'subject';
  pool?: string[]; // e.g. ["apples", "oranges", "bananas"]
}

export interface ChoiceVariable {
  type:    'choice';
  options: string[];
}

export type VariableDefinitions = Record<string, VariableDefinition>;

// ─── Resolved variable values ──────────────────────────────────────

export type ResolvedVariables = Record<string, number | string>;

// ─── Generated question (snapshot stored in session) ───────────────

export interface GeneratedQuestion {
  index:             number;
  question_text:     string;
  variables:         ResolvedVariables;
  correct_answer:    string;
  answer_type:       'typed' | 'multiple_choice';
  choices?:          string[];  // only for multiple_choice
  hint?:             string;
}

// ─── Session answer ────────────────────────────────────────────────

export interface SessionAnswer {
  question_index: number;
  student_answer: string;
  correct:        boolean;
  time_ms:        number;
}

// ─── UI helper types ───────────────────────────────────────────────

export interface ClassWithStats extends Class {
  student_count:  number;
  exercise_count: number;
}

export interface TemplateWithStats extends ExerciseTemplate {
  session_count:  number;
  avg_score_pct:  number | null;
}

export interface StudentProgress {
  template_id:    string;
  template_title: string;
  sessions_count: number;
  best_score_pct: number | null;
  last_played_at: string | null;
}
