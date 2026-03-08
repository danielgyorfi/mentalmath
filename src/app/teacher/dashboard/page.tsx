import { createClient } from '@/lib/supabase/server';
import { redirect }     from 'next/navigation';
import Link             from 'next/link';
import NavBar           from '@/components/NavBar';

export default async function TeacherDashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'student') redirect('/student/dashboard');

  // Fetch teacher's classes with member counts
  const { data: classes } = await supabase
    .from('classes')
    .select('*, class_members(count)')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch teacher's exercise templates with session counts
  const { data: templates } = await supabase
    .from('exercise_templates')
    .select('*, exercise_sessions(count)')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });

  // Recent sessions across all templates
  const templateIds = (templates ?? []).map(t => t.id);
  const { data: recentSessions } = templateIds.length
    ? await supabase
        .from('exercise_sessions')
        .select('id, student_id, template_id, score, max_score, completed_at, profiles(full_name), exercise_templates(title)')
        .in('template_id', templateIds)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(10)
    : { data: [] };

  const classCount    = (classes ?? []).length;
  const templateCount = (templates ?? []).length;
  const studentSet    = new Set(
    (classes ?? []).flatMap(c => (c.class_members as any[]).map(() => 'x')),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role="teacher" name={profile?.full_name ?? ''} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-extrabold text-3xl text-gray-900">
              Welcome, {profile?.full_name?.split(' ')[0]} 👋
            </h1>
            <p className="text-gray-500 mt-1">Manage your classes and exercises</p>
          </div>
          <Link
            href="/teacher/exercises/new"
            className="px-5 py-2.5 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-all shadow-sm flex items-center gap-2"
          >
            <span>＋</span> New exercise
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Classes',   value: classCount,        emoji: '🏫' },
            { label: 'Exercises', value: templateCount,      emoji: '📋' },
            { label: 'Sessions',  value: recentSessions?.length ?? 0, emoji: '🎯' },
            { label: 'Published', value: (templates ?? []).filter(t => t.is_published).length, emoji: '✅' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="text-2xl mb-1">{stat.emoji}</div>
              <div className="font-display font-extrabold text-3xl text-gray-900">{stat.value}</div>
              <div className="text-gray-500 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Classes */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-xl text-gray-900">Classes</h2>
              <CreateClassButton teacherId={user.id} />
            </div>

            {(classes ?? []).length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">
                No classes yet. Create one to get started!
              </p>
            ) : (
              <div className="space-y-3">
                {(classes ?? []).map(c => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-brand-50 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Join code: <span className="font-mono font-bold text-brand-600">{c.join_code}</span>
                      </p>
                    </div>
                    <Link
                      href={`/teacher/classes/${c.id}`}
                      className="text-sm text-brand-500 hover:text-brand-700 font-semibold"
                    >
                      Manage →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent activity */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-display font-bold text-xl text-gray-900 mb-4">Recent activity</h2>

            {(recentSessions ?? []).length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">
                No sessions yet. Share your exercises with students!
              </p>
            ) : (
              <div className="space-y-2">
                {(recentSessions ?? []).map((s: any) => {
                  const pct = s.max_score ? Math.round((s.score / s.max_score) * 100) : null;
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50">
                      <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center text-accent-700 font-bold text-sm flex-shrink-0">
                        {s.profiles?.full_name?.charAt(0) ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {s.profiles?.full_name ?? 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {s.exercise_templates?.title}
                        </p>
                      </div>
                      {pct !== null && (
                        <span className={`text-sm font-bold ${
                          pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-500'
                        }`}>
                          {pct}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Exercise templates quick list */}
        <section className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-xl text-gray-900">Exercise templates</h2>
            <Link
              href="/teacher/exercises"
              className="text-sm text-brand-500 hover:text-brand-700 font-semibold"
            >
              View all →
            </Link>
          </div>

          {(templates ?? []).length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-500 font-semibold">No exercises yet</p>
              <Link
                href="/teacher/exercises/new"
                className="mt-3 inline-block px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
              >
                Create your first exercise
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(templates ?? []).slice(0, 6).map(t => (
                <Link
                  key={t.id}
                  href={`/teacher/exercises/${t.id}/edit`}
                  className="p-4 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-800 group-hover:text-brand-700 truncate flex-1">
                      {t.title}
                    </span>
                    {t.is_published
                      ? <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 ml-2 flex-shrink-0">Live</span>
                      : <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 ml-2 flex-shrink-0">Draft</span>
                    }
                  </div>
                  <p className="text-xs text-gray-400 capitalize">{t.difficulty} · {t.questions_count} questions</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// Client component for creating a class
function CreateClassButton({ teacherId }: { teacherId: string }) {
  return (
    <Link
      href="/teacher/classes/new"
      className="text-sm px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 font-semibold hover:bg-brand-100 transition-colors"
    >
      + New class
    </Link>
  );
}
