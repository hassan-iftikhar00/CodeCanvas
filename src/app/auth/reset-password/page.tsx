"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 6;

// Password strength levels
type PasswordStrength = "none" | "weak" | "medium" | "strong";

interface ValidationState {
    password: {
        touched: boolean;
        error: string | null;
    };
    confirmPassword: {
        touched: boolean;
        error: string | null;
    };
}

export default function ResetPasswordPage() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);
    const [validation, setValidation] = useState<ValidationState>({
        password: { touched: false, error: null },
        confirmPassword: { touched: false, error: null },
    });
    const isSubmitting = useRef(false);
    const router = useRouter();
    const supabase = createClient();

    // Check for valid session on mount (recovery token)
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setTokenValid(true);
            } else {
                setTokenValid(false);
            }
        };

        // Listen for auth state changes (recovery flow)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY" && session) {
                setTokenValid(true);
            }
        });

        checkSession();

        return () => subscription.unsubscribe();
    }, [supabase.auth]);

    // Password validation function
    const validatePassword = useCallback((value: string): string | null => {
        if (!value) {
            return "Password is required";
        }
        if (value.length < MIN_PASSWORD_LENGTH) {
            return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
        }
        return null;
    }, []);

    // Confirm password validation
    const validateConfirmPassword = useCallback((confirm: string, pass: string): string | null => {
        if (!confirm) {
            return "Please confirm your password";
        }
        if (confirm !== pass) {
            return "Passwords do not match";
        }
        return null;
    }, []);

    // Calculate password strength
    const passwordStrength = useMemo((): PasswordStrength => {
        if (!password) return "none";

        let score = 0;

        // Length checks
        if (password.length >= MIN_PASSWORD_LENGTH) score++;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;

        // Character variety checks
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        if (score <= 2) return "weak";
        if (score <= 4) return "medium";
        return "strong";
    }, [password]);

    // Get strength indicator properties
    const strengthConfig = useMemo(() => {
        switch (passwordStrength) {
            case "weak":
                return { label: "Weak", color: "#EF4444", width: "33%" };
            case "medium":
                return { label: "Medium", color: "#F59E0B", width: "66%" };
            case "strong":
                return { label: "Strong", color: "#22C55E", width: "100%" };
            default:
                return { label: "", color: "transparent", width: "0%" };
        }
    }, [passwordStrength]);

    // Check if form is valid for submission
    const isFormValid = useMemo(() => {
        return !validatePassword(password) && !validateConfirmPassword(confirmPassword, password);
    }, [password, confirmPassword, validatePassword, validateConfirmPassword]);

    // Handle password change with validation
    const handlePasswordChange = useCallback((value: string) => {
        setPassword(value);
        if (error) setError(null);

        if (validation.password.touched) {
            setValidation(prev => ({
                ...prev,
                password: { ...prev.password, error: validatePassword(value) }
            }));
        }

        // Also update confirm password validation if it's been touched
        if (validation.confirmPassword.touched && confirmPassword) {
            setValidation(prev => ({
                ...prev,
                confirmPassword: { ...prev.confirmPassword, error: validateConfirmPassword(confirmPassword, value) }
            }));
        }
    }, [error, validation.password.touched, validation.confirmPassword.touched, confirmPassword, validatePassword, validateConfirmPassword]);

    // Handle password blur
    const handlePasswordBlur = useCallback(() => {
        setValidation(prev => ({
            ...prev,
            password: { touched: true, error: validatePassword(password) }
        }));
    }, [password, validatePassword]);

    // Handle confirm password change
    const handleConfirmPasswordChange = useCallback((value: string) => {
        setConfirmPassword(value);
        if (error) setError(null);

        if (validation.confirmPassword.touched) {
            setValidation(prev => ({
                ...prev,
                confirmPassword: { ...prev.confirmPassword, error: validateConfirmPassword(value, password) }
            }));
        }
    }, [error, validation.confirmPassword.touched, password, validateConfirmPassword]);

    // Handle confirm password blur
    const handleConfirmPasswordBlur = useCallback(() => {
        setValidation(prev => ({
            ...prev,
            confirmPassword: { touched: true, error: validateConfirmPassword(confirmPassword, password) }
        }));
    }, [confirmPassword, password, validateConfirmPassword]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate all fields before submission
        const passwordError = validatePassword(password);
        const confirmPasswordError = validateConfirmPassword(confirmPassword, password);

        setValidation({
            password: { touched: true, error: passwordError },
            confirmPassword: { touched: true, error: confirmPasswordError },
        });

        // Prevent submission if validation fails
        if (passwordError || confirmPasswordError) return;

        // Prevent duplicate submissions
        if (isSubmitting.current || loading) return;

        isSubmitting.current = true;
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                // Generic error message
                setError("Unable to reset password. Please try again or request a new reset link.");
                setLoading(false);
                isSubmitting.current = false;
            } else {
                // Sign out to force re-login with new password
                await supabase.auth.signOut();
                setSuccess(true);
                setLoading(false);
                isSubmitting.current = false;

                // Redirect to login after 3 seconds
                setTimeout(() => {
                    router.push("/auth/login");
                }, 3000);
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
            setLoading(false);
            isSubmitting.current = false;
        }
    };

    // Show loading while checking token
    if (tokenValid === null) {
        return (
            <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0A0A]">
                <div className="animate-spin">
                    <svg className="w-8 h-8 text-[#FF6B00]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                </div>
            </div>
        );
    }

    // Show error if no valid token
    if (tokenValid === false) {
        return (
            <div className="relative flex min-h-screen overflow-hidden bg-[#0A0A0A]">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-[#FF6B00]/20 to-transparent rounded-full blur-3xl animate-pulse" />
                    <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-[#FF6B00]/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>

                <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
                    <div className="w-full max-w-md animate-slide-in-up">
                        <div className="relative">
                            <div className="absolute -inset-1 bg-gradient-to-r from-[#FF6B00]/20 via-[#FF6B00]/10 to-[#FF6B00]/20 rounded-3xl blur-xl opacity-50" />

                            <div className="relative rounded-2xl border border-[#2E2E2E] bg-[#1A1A1A]/80 backdrop-blur-xl p-8 shadow-2xl text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-6">
                                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Invalid or expired link</h2>
                                <p className="text-[#A0A0A0] mb-6">
                                    This password reset link is invalid or has expired. Please request a new one.
                                </p>
                                <Link
                                    href="/auth/forgot-password"
                                    className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#CC5800] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#FF6B00]/25 transition-all hover:shadow-[#FF6B00]/40 hover:shadow-xl group"
                                >
                                    Request new link
                                    <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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
                                    <h2 className="text-2xl font-bold text-white mb-2">Password reset successful!</h2>
                                    <p className="text-[#A0A0A0] mb-6">
                                        Your password has been updated. Redirecting you to login...
                                    </p>
                                    <div className="flex justify-center">
                                        <svg className="w-6 h-6 animate-spin text-[#FF6B00]" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    </div>
                                </div>
                            ) : (
                                // Form State
                                <>
                                    <div className="text-center mb-8">
                                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FF6B00]/20 mb-4">
                                            <svg className="w-8 h-8 text-[#FF6B00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                        </div>
                                        <h2 className="text-2xl font-bold text-white mb-2">Set new password</h2>
                                        <p className="text-[#A0A0A0]">
                                            Create a strong password for your account
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

                                        {/* New Password Field */}
                                        <div className="space-y-2">
                                            <label htmlFor="password" className="block text-sm font-medium text-[#A0A0A0]">
                                                New password
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <svg className={`h-5 w-5 transition-colors ${validation.password.touched && validation.password.error ? 'text-red-400' : 'text-[#666666]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                    </svg>
                                                </div>
                                                <input
                                                    id="password"
                                                    name="password"
                                                    type={showPassword ? "text" : "password"}
                                                    autoComplete="new-password"
                                                    disabled={loading}
                                                    value={password}
                                                    onChange={(e) => handlePasswordChange(e.target.value)}
                                                    onBlur={handlePasswordBlur}
                                                    className={`block w-full rounded-xl border bg-[#0A0A0A]/50 pl-12 pr-12 py-3.5 text-white placeholder-[#666666] transition-all focus:outline-none focus:ring-2 focus:bg-[#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed ${validation.password.touched && validation.password.error
                                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                                                        : 'border-[#2E2E2E] focus:border-[#FF6B00] focus:ring-[#FF6B00]/20'
                                                        }`}
                                                    placeholder="••••••••"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#666666] hover:text-[#A0A0A0] transition-colors"
                                                >
                                                    {showPassword ? (
                                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Password validation message */}
                                            {validation.password.touched && validation.password.error && (
                                                <p className="flex items-center gap-1.5 text-xs text-red-400 mt-1.5 animate-fade-in">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {validation.password.error}
                                                </p>
                                            )}

                                            {/* Password strength indicator */}
                                            {password && !validation.password.error && (
                                                <div className="space-y-1.5 mt-2 animate-fade-in">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-[#666666]">Password strength</span>
                                                        <span
                                                            className="text-xs font-medium transition-colors"
                                                            style={{ color: strengthConfig.color }}
                                                        >
                                                            {strengthConfig.label}
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-[#2E2E2E] rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-300 ease-out"
                                                            style={{
                                                                width: strengthConfig.width,
                                                                backgroundColor: strengthConfig.color
                                                            }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-[#666666]">
                                                        Use 8+ characters with uppercase, lowercase, numbers & symbols
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Confirm Password Field */}
                                        <div className="space-y-2">
                                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#A0A0A0]">
                                                Confirm password
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <svg className={`h-5 w-5 transition-colors ${validation.confirmPassword.touched && validation.confirmPassword.error ? 'text-red-400' : 'text-[#666666]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                    </svg>
                                                </div>
                                                <input
                                                    id="confirmPassword"
                                                    name="confirmPassword"
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    autoComplete="new-password"
                                                    disabled={loading}
                                                    value={confirmPassword}
                                                    onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                                                    onBlur={handleConfirmPasswordBlur}
                                                    className={`block w-full rounded-xl border bg-[#0A0A0A]/50 pl-12 pr-12 py-3.5 text-white placeholder-[#666666] transition-all focus:outline-none focus:ring-2 focus:bg-[#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed ${validation.confirmPassword.touched && validation.confirmPassword.error
                                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                                                        : 'border-[#2E2E2E] focus:border-[#FF6B00] focus:ring-[#FF6B00]/20'
                                                        }`}
                                                    placeholder="••••••••"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#666666] hover:text-[#A0A0A0] transition-colors"
                                                >
                                                    {showConfirmPassword ? (
                                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Confirm password validation message */}
                                            {validation.confirmPassword.touched && validation.confirmPassword.error && (
                                                <p className="flex items-center gap-1.5 text-xs text-red-400 mt-1.5 animate-fade-in">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {validation.confirmPassword.error}
                                                </p>
                                            )}

                                            {/* Password match indicator */}
                                            {confirmPassword && !validation.confirmPassword.error && validation.confirmPassword.touched && (
                                                <p className="flex items-center gap-1.5 text-xs text-green-400 mt-1.5 animate-fade-in">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Passwords match
                                                </p>
                                            )}
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading || (validation.password.touched && validation.confirmPassword.touched && !isFormValid)}
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
                                                        Resetting...
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
