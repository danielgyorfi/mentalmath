import { createClient } from '@/lib/supabase/server';
import { NextResponse }  from 'next/server';
import type { NextRequest } from 'next/server';

// GET /api/sessions?template_id=xxx  — get sessions for a teacher's template
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get('template_id');
  const studentId  = searchParams.get('student_id');

  let query = supabase
    .from('exercise_sessions')
    .select(`
      *,
      profiles:student_id (full_name),
      exercise_templates:template_id (title, teacher_id)
    `)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(100);

  if (templateId) query = query.eq('template_id', templateId);
  if (studentId)  query = query.eq('student_id', studentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter: teachers can only see sessions for their own templates
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'teacher' || profile?.role === 'admin') {
    const filtered = (data ?? []).filter(
      (s: any) => s.exercise_templates?.teacher_id === user.id,
    );
    return NextResponse.json(filtered);
  }

  // Students can only see their own sessions
  const filtered = (data ?? []).filter((s: any) => s.student_id === user.id);
  return NextResponse.json(filtered);
}

// POST /api/sessions  — save a completed session (also done client-side via Supabase)
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { template_id, questions, answers, score, max_score } = body;

  if (!template_id || !questions || !answers) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('exercise_sessions')
    .insert({
      student_id:   user.id,
      template_id,
      questions,
      answers,
      score:        score ?? 0,
      max_score:    max_score ?? questions.length,
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
