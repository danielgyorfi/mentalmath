import { createClient } from '@/lib/supabase/server';
import { NextResponse }  from 'next/server';
import type { NextRequest } from 'next/server';

// GET /api/classes  — list teacher's classes
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('classes')
    .select('*, class_members(count)')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/classes  — create a new class
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Class name is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('classes')
    .insert({ name: name.trim(), teacher_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// POST /api/classes/join  — student joins with a code (handled in /api/classes/join/route.ts)
