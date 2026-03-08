import { createClient } from '@/lib/supabase/server';
import { redirect }     from 'next/navigation';
import NavBar           from '@/components/NavBar';
import ExerciseEditor   from '@/components/ExerciseEditor';

export default async function NewExercisePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'student') redirect('/student/dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role="teacher" name={profile?.full_name ?? ''} />
      <ExerciseEditor teacherId={user.id} />
    </div>
  );
}
