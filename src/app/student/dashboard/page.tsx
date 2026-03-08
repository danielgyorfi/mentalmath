import { createClient } from '@/lib/supabase/server';
import { redirect }     from 'next/navigation';
import Link             from 'next/link';
import type { ExerciseTemplate, Class } from '@/lib/types';
import NavBar from '@/components/NavBar';

interface ClassWithExercises extends Class {
  exercise_templates: ExerciseTemplate[];
}

export default async function StudentDashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'student') redirect('/teacher/dashboard');

  // Fetch classes the student is in, with exercises
  const { data: memberships } = await supabase
    .from('class_members')
    .select(`
      class_id,
      classes (
        id, name, join_code,
        class_exercises (
          exercise_templates (*)
        )
      )
    `)
    .eq('student_id', user.id);

  // Fetch recent session scores
  const { data: sessions } = await supabase
    .from('exercise_sessions')
    .select('template_id, score, max_score, completed_at')
    .eq('student_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(20);

  const scoresByTemplate: Record<string, number[]> = {};
  sessions?.forEach(s => {
    if (s.score !== null && s.max_score) {
      const pct = Math.round((s.score / s.max_score) * 100);
      scoresByTemplate[s.template_id] = [
        ...(scoresByTemplate[s.template_id] ?? []),
        pct,
      ];
    }
  });

  const classes = (memberships ?? [])
    .map(m => (m as any).classes)
    .filter(Boolean) as any[];

  const allExercises: ExerciseTemplate[] = [];
  classes.forEach(c => {
    (c.class_exercises ?? []).forEach((ce: any) => {
      if (ce.exercise_templates) allExercises.push(ce.exercise_templates);
    });
  });

  const uniqueExercises = Array.from(
    new Map(allExercises.map(e => [e.id, e])).values(),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role="student" name={profile?.full_name ?? ''} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="font-display font-extrabold text-3xl text-gray-900">
            Hey {profile?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 mt-1">Pick an exercise and start practising!</p>
        </div>

        {/* Join a class CTA */}
        {classes.length === 0 && (
          <JoinClassBanner />
        )}

        {/* Exercise grid */}
        {uniqueExercises.length > 0 ? (
          <div>
            <h2 className="font-display font-bold text-xl text-gray-800 mb-4">
              Your exercises
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {uniqueExercises.map(ex => {
                const scores   = scoresByTemplate[ex.id] ?? [];
                const bestPct  = scores.length ? Math.max(...scores) : null;
                const attempts = scores.length;

                return (
                  <Link
                    key={ex.id}
                    href={`/student/play/${ex.id}`}
                    className="group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-brand-200 transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-2xl">{difficultyEmoji(ex.difficulty)}</span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${difficultyBadge(ex.difficulty)}`}>
                        {ex.difficulty}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-lg text-gray-900 group-hover:text-brand-600 transition-colors mb-1">
                      {ex.title}
                    </h3>
                    {ex.description && (
                      <p className="text-gray-500 text-sm mb-3 line-clamp-2">{ex.description}</p>
                    )}
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <span>{ex.questions_count} questions</span>
                      {bestPct !== null ? (
                        <span className="font-semibold text-success-600">
                          Best: {bestPct}%
                          {bestPct === 100 ? ' 🌟' : ''}
                        </span>
                      ) : (
                        <span className="text-gray-300">Not attempted</span>
                      )}
                    </div>
                    {attempts > 0 && (
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-400 rounded-full transition-all"
                          style={{ width: `${bestPct}%` }}
                        />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : classes.length > 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">📭</div>
            <p className="font-display font-semibold text-lg">No exercises assigned yet.</p>
            <p className="text-sm mt-1">Ask your teacher to assign exercises to your class.</p>
          </div>
        ) : null}

        {/* Classes section */}
        {classes.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display font-bold text-xl text-gray-800 mb-4">
              Your classes
            </h2>
            <div className="flex flex-wrap gap-3">
              {classes.map((c: any) => (
                <div key={c.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-sm">
                  <span className="font-semibold text-gray-800">{c.name}</span>
                  <span className="text-gray-400 ml-2">#{c.join_code}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Join Class Modal (client component) */}
      <JoinClassSection studentId={user.id} />
    </div>
  );
}

function JoinClassBanner() {
  return (
    <div className="bg-brand-50 border border-brand-200 rounded-2xl p-6 mb-8 flex items-center gap-4">
      <div className="text-4xl">🏫</div>
      <div>
        <p className="font-display font-bold text-brand-800 text-lg">Join a class to get started</p>
        <p className="text-brand-600 text-sm mt-0.5">
          Ask your teacher for the 6-letter class code, then enter it below.
        </p>
      </div>
    </div>
  );
}

// Floating join-class button (rendered below)
function JoinClassSection({ studentId }: { studentId: string }) {
  return null; // Handled by client component below
}

function difficultyEmoji(d: string) {
  return d === 'easy' ? '🟢' : d === 'medium' ? '🟡' : '🔴';
}

function difficultyBadge(d: string) {
  return d === 'easy'
    ? 'bg-green-100 text-green-700'
    : d === 'medium'
    ? 'bg-yellow-100 text-yellow-700'
    : 'bg-red-100 text-red-700';
}
