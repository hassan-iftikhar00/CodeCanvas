"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/");
          return;
        }

        const response = await fetch("/api/profile");
        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }

        const { profile } = await response.json();
        setProfile(profile);
        setFullName(profile.full_name || "");
        setAvatarUrl(profile.avatar_url || "");
      } catch (error) {
        console.error("Error fetching profile:", error);
        setMessage({ type: "error", text: "Failed to load profile" });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router, supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!validTypes.includes(file.type)) {
        setMessage({
          type: "error",
          text: "Please upload a valid image file (JPEG, PNG, GIF, or WebP)",
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: "error", text: "Image size must be less than 5MB" });
        return;
      }

      setAvatarFile(file);
      const previewUrl = URL.createObjectURL(file);
      setAvatarUrl(previewUrl);
      setMessage(null);
    }
  };

  const handleUploadImage = async () => {
    if (!avatarFile) return null;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", avatarFile);

      const response = await fetch("/api/upload-avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Upload API error:", error);
        const errorMessage = error.details
          ? `${error.error}\n${error.details}`
          : error.error || "Failed to upload image";
        throw new Error(errorMessage);
      }

      const { url } = await response.json();
      return url;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      let finalAvatarUrl = avatarUrl;

      if (avatarFile) {
        try {
          finalAvatarUrl = await handleUploadImage();
          if (!finalAvatarUrl) {
            throw new Error("Failed to upload image");
          }
        } catch (uploadError) {
          const errorMsg =
            uploadError instanceof Error
              ? uploadError.message
              : "Failed to upload image";
          setMessage({ type: "error", text: errorMsg });
          setSaving(false);
          return;
        }
      }

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName,
          avatar_url: finalAvatarUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      const { profile: updatedProfile } = await response.json();
      setProfile(updatedProfile);
      setAvatarFile(null);
      setMessage({ type: "success", text: "Profile updated successfully!" });

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Failed to update profile",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--cc-bg-canvas)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--cc-border-subtle)] border-t-[var(--cc-accent)]" />
          <p className="text-[12px] text-[var(--cc-text-secondary)]">
            Loading profile...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cc-bg-canvas)]">
      {/* Header */}
      <header className="border-b border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)]">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--cc-text-secondary)] transition-colors hover:text-[var(--cc-text-primary)]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Dashboard
          </Link>
          <Link href="/dashboard" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-6 w-6" />
            <span className="text-[14px] font-semibold tracking-tight text-[var(--cc-text-primary)]">
              CodeCanvas
            </span>
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 0.9, 0.28, 1] }}
        >
          <div className="mb-6">
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--cc-text-primary)]">
              Profile settings
            </h1>
            <p className="mt-1 text-[13px] text-[var(--cc-text-secondary)]">
              Manage your account information and preferences.
            </p>
          </div>

          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                role="status"
                aria-live="polite"
                className={`mb-5 flex items-center gap-2.5 rounded-[var(--cc-radius-card)] border px-3.5 py-2.5 text-[13px] ${
                  message.type === "success"
                    ? "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.08)] text-[var(--cc-success)]"
                    : "border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] text-[var(--cc-error)]"
                }`}
              >
                {message.type === "success" ? (
                  <svg
                    className="h-4 w-4 flex-none"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4 flex-none"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
                <span className="font-medium">{message.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-5">
            {/* Personal Information */}
            <section className="rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-5">
              <h2 className="mb-4 text-[14px] font-semibold text-[var(--cc-text-primary)]">
                Personal information
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Avatar */}
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full bg-[var(--cc-accent)] text-[20px] font-semibold text-white">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-16 w-16 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <span>
                        {fullName?.charAt(0)?.toUpperCase() ||
                          profile?.email?.charAt(0)?.toUpperCase() ||
                          "U"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[13px] font-semibold text-[var(--cc-text-primary)]">
                      Profile picture
                    </h3>
                    <p className="mt-0.5 text-[11px] text-[var(--cc-text-muted)]">
                      Max 5MB. JPEG, PNG, GIF or WebP.
                    </p>
                    <label
                      htmlFor="avatar-upload"
                      className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] px-3 py-1.5 text-[12px] font-semibold text-[var(--cc-text-primary)] transition-colors hover:border-[var(--cc-border-emphasis)] focus-within:ring-2 focus-within:ring-[var(--cc-accent)]"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {avatarFile ? avatarFile.name : "Choose image"}
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>

                <Field
                  id="email"
                  label="Email address"
                  hint="Email cannot be changed"
                >
                  <input
                    type="email"
                    id="email"
                    value={profile?.email || ""}
                    disabled
                    className="w-full cursor-not-allowed rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-canvas)] px-3 py-2 text-[13px] text-[var(--cc-text-muted)]"
                  />
                </Field>

                <Field id="fullName" label="Full name">
                  <input
                    type="text"
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-canvas)] px-3 py-2 text-[13px] text-[var(--cc-text-primary)] placeholder:text-[var(--cc-text-muted)] transition-colors focus:border-[var(--cc-accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--cc-accent-glow)]"
                  />
                </Field>

                <Field
                  id="avatarUrl"
                  label="Avatar URL (Optional)"
                  hint={
                    avatarFile
                      ? "Clear uploaded file to enter a URL"
                      : "Or enter a URL to an image"
                  }
                >
                  <input
                    type="url"
                    id="avatarUrl"
                    value={avatarUrl}
                    onChange={(e) => {
                      setAvatarUrl(e.target.value);
                      setAvatarFile(null);
                    }}
                    placeholder="https://example.com/avatar.jpg"
                    disabled={!!avatarFile}
                    className="w-full rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-canvas)] px-3 py-2 text-[13px] text-[var(--cc-text-primary)] placeholder:text-[var(--cc-text-muted)] transition-colors focus:border-[var(--cc-accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--cc-accent-glow)] disabled:opacity-50"
                  />
                </Field>

                <div className="flex items-center gap-2 pt-2">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="submit"
                    disabled={saving || uploading}
                    className="inline-flex items-center gap-1.5 rounded-[var(--cc-radius-button)] bg-[var(--cc-accent)] px-4 py-2 text-[13px] font-semibold text-white transition-all hover:shadow-[0_0_20px_var(--cc-accent-glow-strong)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]"
                  >
                    {saving || uploading ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        {uploading ? "Uploading..." : "Saving..."}
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Save changes
                      </>
                    )}
                  </motion.button>
                  <Link
                    href="/dashboard"
                    className="rounded-[var(--cc-radius-button)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-elevated)] px-4 py-2 text-[13px] font-semibold text-[var(--cc-text-primary)] transition-colors hover:border-[var(--cc-border-emphasis)]"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </section>

            {/* Account Information */}
            <section className="rounded-[var(--cc-radius-card)] border border-[var(--cc-border-subtle)] bg-[var(--cc-bg-surface)] p-5">
              <h2 className="mb-3 text-[14px] font-semibold text-[var(--cc-text-primary)]">
                Account information
              </h2>
              <dl className="space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <dt className="text-[var(--cc-text-secondary)]">
                    Account created
                  </dt>
                  <dd className="text-[var(--cc-text-primary)]">
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString()
                      : "N/A"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--cc-text-secondary)]">
                    Last updated
                  </dt>
                  <dd className="text-[var(--cc-text-primary)]">
                    {profile?.updated_at
                      ? new Date(profile.updated_at).toLocaleDateString()
                      : "N/A"}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Danger Zone */}
            <section className="rounded-[var(--cc-radius-card)] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.04)] p-5">
              <h2 className="mb-1 text-[14px] font-semibold text-[var(--cc-error)]">
                Danger zone
              </h2>
              <p className="mb-3 text-[12px] text-[var(--cc-text-secondary)]">
                Signing out will end your current session.
              </p>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleLogout}
                className="cc-danger inline-flex items-center gap-1.5 rounded-[var(--cc-radius-button)] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--cc-error)] transition-colors hover:bg-[rgba(239,68,68,0.16)]"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sign out
              </motion.button>
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[12px] font-medium text-[var(--cc-text-secondary)]"
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[11px] text-[var(--cc-text-muted)]">{hint}</p>
      )}
    </div>
  );
}
