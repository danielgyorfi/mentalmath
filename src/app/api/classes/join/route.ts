import { createClient } from '@/lib/supabase/server';
import { NextResponse }  from 'next/server';
import type { NextRequest } from 'next/server';

// POST /api/classes/join  { code: "ABC123" }
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { code } = await req.json();
  if (!code?.trim()) {
    return NextResponse.json({ error: 'Class code is required' }, { status: 400 });
  }

  // Find the class
  const { data: classRow, error: classErr } = await supabase
    .from('classes')
    .select('id, name')
    .eq('join_code', code.trim().toUpperCase())
    .single();

  if (classErr || !classRow) {
    return NextResponse.json({ error: 'Class not found. Check the code and try again.' }, { status: 404 });
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('class_members')
    .select('class_id')
    .eq('class_id', classRow.id)
    .eq('student_id', user.id)
    .single();

  if (existing) {
    return NextResponse.json({ message: 'Already in this class', class: classRow });
  }

  // Join
  const { error: joinErr } = await supabase
    .from('class_members')
    .insert({ class_id: classRow.id, student_id: user.id });

  if (joinErr) {
    return NextResponse.json({ error: joinErr.message }, { status: 500 });
  }

  return NextResponse.json({ message: `Joined class "${classRow.name}"!`, class: classRow }, { status: 201 });
}
