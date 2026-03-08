import { createClient }   from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import ExercisePlayer       from '@/components/ExercisePlayer';
import type { ExerciseTemplate } from '@/lib/types';
import NavBar from '@/components/NavBar';

interface Props {
  params: { exerciseId: string };
}

export default async function PlayPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  // Fetch the exercise template
  const { data: template } = await supabase
    .from('exercise_templates')
    .select('*')
    .eq('id', params.exerciseId)
    .single();

  if (!template) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role="student" name={profile?.full_name ?? ''} />
      <ExercisePlayer template={template as ExerciseTemplate} userId={user.id} />
    </div>
  );
}
