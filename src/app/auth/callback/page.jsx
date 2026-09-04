"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const handleAuth = async () => {
      const code = searchParams.get('code');
      const next = searchParams.get('next') ?? '/';
      const error = searchParams.get('error');
      
      if (error) {
        setErrorMsg(searchParams.get('error_description') || 'Authentication failed');
        setTimeout(() => router.push('/login?error=auth-callback-failed'), 3000);
        return;
      }

      if (code) {
        // Supabase createBrowserClient automatically handles the code exchange in the background.
        // We just need to verify the session exists.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          // Fallback manual exchange just in case
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setErrorMsg(exchangeError.message);
            setTimeout(() => router.push('/login?error=auth-callback-failed'), 3000);
            return;
          }
        }
        
        // Success
        router.push(next);
      } else {
        router.push(next);
      }
    };

    handleAuth();
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      {errorMsg ? (
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Autentikasi Gagal</h2>
          <p className="text-gray-600">{errorMsg}</p>
          <p className="text-sm text-gray-500 mt-4">Mengalihkan kembali ke halaman login...</p>
        </div>
      ) : (
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-medium text-gray-800">Menyelesaikan login...</h2>
          <p className="text-sm text-gray-500 mt-2">Mohon tunggu sebentar.</p>
        </div>
      )}
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
