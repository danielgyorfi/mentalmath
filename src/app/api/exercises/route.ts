import { createClient } from '@/lib/supabase/server';
import { NextResponse }  from 'next/server';
import type { NextRequest } from 'next/server';

// GET /api/exercises  — list templates for the authed teacher
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const published = searchParams.get('published');

  let query = supabase
    .from('exercise_templates')
    .select('*')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });

  if (published === 'true')  query = query.eq('is_published', true);
  if (published === 'false') query = query.eq('is_published', false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// POST /api/exercises  — create a new template
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Validate required fields
  const required = ['title', 'question_template', 'answer_expression', 'age_groups'];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('exercise_templates')
    .insert({ ...body, teacher_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
