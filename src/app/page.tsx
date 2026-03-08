import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function LandingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Get role from profile and redirect
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'teacher' || profile?.role === 'admin') {
      redirect('/teacher/dashboard');
    } else {
      redirect('/student/dashboard');
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-accent-50 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Image src="/capymath-icon.png" alt="CapyMath" width={36} height={36} className="rounded-full" />
          <span className="font-display font-800 text-2xl text-brand-700">MentalMath</span>
        </div>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl text-brand-600 font-semibold hover:bg-brand-50 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-colors shadow-sm"
          >
            Sign up free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 max-w-4xl mx-auto w-full">
        <div className="text-6xl mb-4 animate-bounce-gentle">🎉</div>
        <h1 className="font-display font-extrabold text-5xl md:text-6xl text-gray-900 leading-tight mb-6">
          Make maths <span className="text-brand-500">fun</span>
          <br />for every kid
        </h1>
        <p className="text-lg md:text-xl text-gray-600 max-w-2xl mb-10 leading-relaxed">
          Teachers create randomised exercises. Students practise anywhere — phone, tablet, or laptop.
          Track progress. Celebrate wins. 🏆
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/signup?role=teacher"
            className="px-8 py-4 rounded-2xl bg-brand-500 text-white font-display font-bold text-lg hover:bg-brand-600 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            I'm a Teacher →
          </Link>
          <Link
            href="/signup?role=student"
            className="px-8 py-4 rounded-2xl bg-accent-500 text-white font-display font-bold text-lg hover:bg-accent-600 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            I'm a Student →
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              emoji: '🎲',
              title: 'Always different',
              desc: 'Numbers, names, and subjects are randomised every time so kids can\'t memorise answers.',
            },
            {
              emoji: '📱',
              title: 'Works everywhere',
              desc: 'Fully responsive — works beautifully on a phone, tablet, or laptop screen.',
            },
            {
              emoji: '📊',
              title: 'Track progress',
              desc: 'Teachers see scores per student, per exercise. Students see their best scores.',
            },
          ].map((f) => (
            <div key={f.title} className="text-center p-6 rounded-2xl bg-gray-50 hover:bg-brand-50 transition-colors">
              <div className="text-4xl mb-3">{f.emoji}</div>
              <h3 className="font-display font-bold text-xl text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-gray-400 text-sm">
        © {new Date().getFullYear()} MentalMath · Built with Next.js + Supabase · Hosted on Vercel
      </footer>
    </main>
  );
}
