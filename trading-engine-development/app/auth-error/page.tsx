import { Suspense } from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function AuthErrorContent() {
    // Note: In a real app, you'd use useSearchParams from 'next/navigation'
    // This is a server component, so we'll show a generic error
    return (
        <div className='min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center p-4'>
            <div className='max-w-md w-full'>
                <div className='bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/30 rounded-lg p-8 text-center'>
                    <AlertCircle className='w-16 h-16 text-red-500 mx-auto mb-4' />

                    <h1 className='text-2xl font-bold text-white mb-2'>Authentication Error</h1>

                    <p className='text-gray-400 mb-6'>
                        There was an issue during the OAuth authentication process. This usually means the redirect URI
                        is not properly configured in your Deriv OAuth application.
                    </p>

                    <div className='bg-slate-800/50 border border-slate-700 rounded p-4 mb-6 text-left'>
                        <h3 className='text-sm font-semibold text-slate-300 mb-2'>How to fix this:</h3>
                        <ol className='text-xs text-slate-400 space-y-1 list-decimal list-inside'>
                            <li>Log in to your Deriv account</li>
                            <li>Go to Settings → API Tokens → OAuth Apps</li>
                            <li>Edit your OAuth app (33tdJCamBVncjRj9m3WFe)</li>
                            <li>Add your app's callback URL to "Redirect URIs":</li>
                            <code className='block bg-slate-900 p-2 rounded mt-2 text-cyan-400 break-all text-[10px]'>
                                {typeof window !== 'undefined' && window.location.origin}
                            </code>
                        </ol>
                    </div>

                    <div className='space-y-2'>
                        <Link
                            href='/'
                            className='inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors'
                        >
                            <ArrowLeft className='w-4 h-4' />
                            Back to Home
                        </Link>

                        <a
                            href='https://app.deriv.com/account/api-token'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='inline-flex items-center justify-center w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition-colors'
                        >
                            Manage OAuth Apps
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AuthErrorContent />
        </Suspense>
    );
}
