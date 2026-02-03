"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Email validation regex - checks for @ and valid domain structure
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [emailTouched, setEmailTouched] = useState(false);
    const isSubmitting = useRef(false);
    const supabase = createClient();

    // Email validation function
    const validateEmail = useCallback((value: string): string | null => {
        if (!value.trim()) {
            return "Email is required";
        }
        if (!value.includes("@")) {
            return "Email must contain @";
        }
        if (!EMAIL_REGEX.test(value)) {
            return "Please enter a valid email address";
        }
        return null;
    }, []);

    const emailError = useMemo(() => validateEmail(email), [email, validateEmail]);

    // Check if form is valid for submission
    const isFormValid = useMemo(() => !emailError, [emailError]);

    // Handle email change with validation
    const handleEmailChange = useCallback((value: string) => {
        setEmail(value);
        if (error) setError(null);
    }, [error]);

    // Handle email blur
    const handleEmailBlur = useCallback(() => {
        setEmailTouched(true);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Mark field as touched and validate
        setEmailTouched(true);
        if (emailError) return;

        // Prevent duplicate submissions
        if (isSubmitting.current || loading) return;

        isSubmitting.current = true;
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
            });

            if (error) {
                // Generic error message - don't expose if email exists or not
                setError("Unable to process your request. Please try again later.");
                setLoading(false);
                isSubmitting.current = false;
            } else {
                setSuccess(true);
                setLoading(false);
                isSubmitting.current = false;
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
            setLoading(false);
            isSubmitting.current = false;
        }
    };

    return (
        <div className="relative flex min-h-screen overflow-hidden bg-[#0A0A0A]">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-[#FF6B00]/20 to-transparent rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-[#FF6B00]/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FF6B00]/5 rounded-full blur-3xl" />
            </div>

            {/* Centered Form */}
            <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-md animate-slide-in-up">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <Link href="/" className="inline-flex items-center gap-2 text-3xl font-bold text-white hover:text-[#FF6B00] transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B00] to-[#CC5800] flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.39m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.764m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                                </svg>
                            </div>
                            CodeCanvas
                        </Link>
                    </div>

                    {/* Form Card */}
                    <div className="relative">
                        {/* Glow effect behind card */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-[#FF6B00]/20 via-[#FF6B00]/10 to-[#FF6B00]/20 rounded-3xl blur-xl opacity-50" />

                        <div className="relative rounded-2xl border border-[#2E2E2E] bg-[#1A1A1A]/80 backdrop-blur-xl p-8 shadow-2xl">
                            {success ? (
                                // Success State
                                <div className="text-center animate-fade-in">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-6">
                                        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
                                    <p className="text-[#A0A0A0] mb-6">
                                        If an account exists with that email, we&apos;ve sent you a link to reset your password.
                                    </p>
                                    <p className="text-sm text-[#666666] mb-6">
                                        Didn&apos;t receive the email? Check your spam folder or try again.
                                    </p>
                                    <Link
                                        href="/auth/login"
                                        className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#CC5800] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#FF6B00]/25 transition-all hover:shadow-[#FF6B00]/40 hover:shadow-xl group"
                                    >
                                        Back to login
                                        <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </Link>
                                </div>
                            ) : (
                                // Form State
                                <>
                                    <div className="text-center mb-8">
                                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FF6B00]/20 mb-4">
                                            <svg className="w-8 h-8 text-[#FF6B00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                            </svg>
                                        </div>
                                        <h2 className="text-2xl font-bold text-white mb-2">Forgot password?</h2>
                                        <p className="text-[#A0A0A0]">
                                            No worries, we&apos;ll send you reset instructions.
                                        </p>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-5">
                                        {error && (
                                            <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400 animate-shake">
                                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {error}
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <label htmlFor="email" className="block text-sm font-medium text-[#A0A0A0]">
                                                Email address
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <svg className={`h-5 w-5 transition-colors ${emailTouched && emailError ? 'text-red-400' : 'text-[#666666]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                                    </svg>
                                                </div>
                                                <input
                                                    id="email"
                                                    name="email"
                                                    type="email"
                                                    autoComplete="email"
                                                    disabled={loading}
                                                    value={email}
                                                    onChange={(e) => handleEmailChange(e.target.value)}
                                                    onBlur={handleEmailBlur}
                                                    className={`block w-full rounded-xl border bg-[#0A0A0A]/50 pl-12 pr-4 py-3.5 text-white placeholder-[#666666] transition-all focus:outline-none focus:ring-2 focus:bg-[#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed ${emailTouched && emailError
                                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                                                        : 'border-[#2E2E2E] focus:border-[#FF6B00] focus:ring-[#FF6B00]/20'
                                                        }`}
                                                    placeholder="you@example.com"
                                                />
                                            </div>
                                            {/* Email validation message */}
                                            {emailTouched && emailError && (
                                                <p className="flex items-center gap-1.5 text-xs text-red-400 mt-1.5 animate-fade-in">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {emailError}
                                                </p>
                                            )}
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading || (emailTouched && !isFormValid)}
                                            className={`relative w-full overflow-hidden rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg transition-all group ${isFormValid
                                                ? 'bg-gradient-to-r from-[#FF6B00] to-[#CC5800] shadow-[#FF6B00]/25 hover:shadow-[#FF6B00]/40 hover:shadow-xl'
                                                : 'bg-gradient-to-r from-[#FF6B00]/70 to-[#CC5800]/70 shadow-[#FF6B00]/15'
                                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                {loading ? (
                                                    <>
                                                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                        </svg>
                                                        Sending...
                                                    </>
                                                ) : (
                                                    <>
                                                        Reset password
                                                        <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                        </svg>
                                                    </>
                                                )}
                                            </span>
                                        </button>
                                    </form>

                                    <p className="mt-8 text-center text-sm text-[#666666]">
                                        <Link href="/auth/login" className="inline-flex items-center gap-2 font-semibold text-[#FF6B00] hover:text-[#FF8533] transition-colors">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                            </svg>
                                            Back to login
                                        </Link>
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="mt-8 text-center text-xs text-[#666666]">
                        Need help?{" "}
                        <Link href="#" className="text-[#A0A0A0] hover:text-white transition-colors">Contact support</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
