'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';

interface Props {
  role:  UserRole;
  name:  string;
}

export default function NavBar({ role, name }: Props) {
  const router   = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const homeHref = role === 'student' ? '/student/dashboard' : '/teacher/dashboard';

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href={homeHref} className="flex items-center gap-2">
          <Image src="/capymath-icon.png" alt="CapyMath" width={28} height={28} className="rounded-full" />
          <span className="font-display font-extrabold text-xl text-brand-700 hidden sm:block">
            MentalMath
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {role === 'teacher' && (
            <>
              <Link
                href="/teacher/dashboard"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-600 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/teacher/exercises"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-600 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              >
                Exercises
              </Link>
            </>
          )}

          {/* Avatar / name */}
          <div className="flex items-center gap-2 ml-3 pl-3 border-l border-gray-100">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm">
              {name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">
              {name.split(' ')[0]}
            </span>
            <button
              onClick={handleSignOut}
              className="ml-1 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
