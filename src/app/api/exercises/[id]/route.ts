import { createClient } from '@/lib/supabase/server';
import { NextResponse }  from 'next/server';

// GET /api/exercises/[id]
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('exercise_templates')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(data);
}

// PATCH /api/exercises/[id]
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Ensure only the owner can update
  const { data, error } = await supabase
    .from('exercise_templates')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('teacher_id', user.id) // RLS-enforced ownership check
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });

  return NextResponse.json(data);
}

// DELETE /api/exercises/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('exercise_templates')
    .delete()
    .eq('id', params.id)
    .eq('teacher_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
