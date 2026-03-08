import { createClient } from '@/lib/supabase/server';
import { redirect }     from 'next/navigation';
import Link             from 'next/link';
import NavBar           from '@/components/NavBar';
import type { ExerciseTemplate } from '@/lib/types';

export default async function ExercisesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'student') redirect('/student/dashboard');

  const { data: templates } = await supabase
    .from('exercise_templates')
    .select('*')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role="teacher" name={profile?.full_name ?? ''} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-extrabold text-3xl text-gray-900">Exercise templates</h1>
            <p className="text-gray-500 mt-1">Create and manage your exercise library</p>
          </div>
          <Link
            href="/teacher/exercises/new"
            className="px-5 py-2.5 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-all shadow-sm flex items-center gap-2"
          >
            <span>＋</span> New exercise
          </Link>
        </div>

        {(templates ?? []).length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="font-display font-bold text-2xl text-gray-700 mb-2">No exercises yet</h2>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              Create your first exercise template. Teachers define the structure; the app randomises numbers, names, and subjects for every student.
            </p>
            <Link
              href="/teacher/exercises/new"
              className="px-8 py-3.5 rounded-2xl bg-brand-500 text-white font-display font-bold text-lg hover:bg-brand-600 transition-all shadow-md"
            >
              Create exercise →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(templates as ExerciseTemplate[]).map(t => (
              <ExerciseCard key={t.id} template={t} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ExerciseCard({ template }: { template: ExerciseTemplate }) {
  const ageBadge = template.age_groups.join(', ');

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-brand-200 transition-all flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-wrap gap-1.5">
          {template.is_published
            ? <span className="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-0.5 font-semibold">✅ Live</span>
            : <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2.5 py-0.5 font-semibold">Draft</span>
          }
          <span className="text-xs bg-brand-50 text-brand-700 rounded-full px-2.5 py-0.5 font-semibold capitalize">
            {template.difficulty}
          </span>
        </div>
      </div>

      <h3 className="font-display font-bold text-lg text-gray-900 mb-1">{template.title}</h3>
      {template.description && (
        <p className="text-gray-500 text-sm mb-3 line-clamp-2 flex-1">{template.description}</p>
      )}

      <div className="text-xs text-gray-400 space-y-1 mb-4 mt-auto">
        <div className="flex items-center gap-2">
          <span>📋 {template.questions_count} questions</span>
          <span>·</span>
          <span>👥 Ages {ageBadge}</span>
        </div>
        <div className="font-mono bg-gray-50 rounded-lg px-2 py-1 text-gray-500 truncate">
          {template.question_template}
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/teacher/exercises/${template.id}/edit`}
          className="flex-1 text-center py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
        >
          Edit
        </Link>
        <Link
          href={`/teacher/exercises/${template.id}/preview`}
          className="flex-1 text-center py-2 rounded-xl bg-brand-50 text-sm font-semibold text-brand-600 hover:bg-brand-100 transition-colors"
        >
          Preview
        </Link>
      </div>
    </div>
  );
}
