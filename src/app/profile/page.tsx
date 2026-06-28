"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { DeleteAccountModal } from "@/components/profile/DeleteAccountModal";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProfileSkeleton from "@/components/profile/ProfileSkeleton";
import { DRAFTING_TOKENS as T } from "@/lib/drafting-room/tokens";

const MONO = "var(--font-jetbrains-mono, ui-monospace, monospace)";
const SANS = "var(--font-inter, ui-sans-serif, system-ui)";
const SERIF = "var(--font-instrument-serif, ui-serif, Georgia, serif)";

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

  const handleDeleteAccount = async () => {
    const response = await fetch("/api/account/delete", { method: "POST" });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.error || "Failed to delete account. Please try again."
      );
    }

    // Server has deleted auth.users - clear the local session and navigate away.
    // Use window.location for a full reload so all in-memory auth state is gone.
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <ProfileSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <ErrorBoundary
        variant="panel"
        title="Profile unavailable"
        message="We could not load this page. Try again in a moment."
      >
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 0.9, 0.28, 1] }}
        >
          <div className="mb-6">
            <div
              className="text-[10px] tracking-[0.18em] uppercase"
              style={{ color: T.muted, fontFamily: MONO }}
            >
              Account · Profile
            </div>
            <h1
              className="mt-1 text-[36px] leading-[1.05] tracking-[-0.02em]"
              style={{ color: T.graphite, fontFamily: SERIF, fontWeight: 400 }}
            >
              Profile.
            </h1>
            <p
              className="mt-1.5 text-[13px] leading-[1.55]"
              style={{ color: T.muted, fontFamily: SANS }}
            >
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
                className="mb-5 flex items-center gap-2.5 px-3.5 py-2 text-[12px]"
                style={{
                  border: `1px solid ${
                    message.type === "success" ? T.success : T.error
                  }`,
                  background: `${
                    message.type === "success" ? T.success : T.error
                  }10`,
                  color: message.type === "success" ? T.success : T.error,
                  fontFamily: SANS,
                }}
              >
                <span
                  className="px-1.5 py-0.5 text-[9px] tracking-[0.18em] uppercase"
                  style={{
                    border: `1px solid currentColor`,
                    fontFamily: MONO,
                  }}
                >
                  {message.type === "success" ? "Success" : "Error"}
                </span>
                <span>{message.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-5">
            {/* Personal Information */}
            <section
              style={{
                background: T.paper,
                border: `1px solid ${T.rule}`,
              }}
            >
              <div
                className="flex items-center justify-between border-b px-5 py-2 text-[10px] tracking-[0.16em] uppercase"
                style={{
                  background: T.vellum,
                  borderColor: T.rule,
                  color: T.muted,
                  fontFamily: MONO,
                }}
              >
                <span style={{ color: T.graphite }}>Personal information</span>
                <span>Editable</span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
                {/* Avatar */}
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden text-[20px]"
                    style={{
                      background: T.graphite,
                      color: T.paper,
                      border: `1px solid ${T.rule}`,
                      fontFamily: MONO,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-16 w-16 object-cover"
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
                    <div
                      className="text-[10px] tracking-[0.16em] uppercase"
                      style={{ color: T.muted, fontFamily: MONO }}
                    >
                      Profile picture
                    </div>
                    <p
                      className="mt-0.5 text-[11px]"
                      style={{ color: T.muted, fontFamily: SANS }}
                    >
                      Max 5MB. JPEG, PNG, GIF or WebP.
                    </p>
                    <label
                      htmlFor="avatar-upload"
                      className="mt-2 inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-[0.16em] uppercase transition-colors"
                      style={{
                        background: T.paper,
                        border: `1px solid ${T.rule}`,
                        color: T.graphite,
                        fontFamily: MONO,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = T.graphite;
                        e.currentTarget.style.color = T.paper;
                        e.currentTarget.style.borderColor = T.graphite;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = T.paper;
                        e.currentTarget.style.color = T.graphite;
                        e.currentTarget.style.borderColor = T.rule;
                      }}
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                    className="w-full cursor-not-allowed px-3 py-2 text-[13px]"
                    style={{
                      background: T.vellum,
                      border: `1px solid ${T.rule}`,
                      color: T.muted,
                      fontFamily: SANS,
                    }}
                  />
                </Field>

                <Field id="fullName" label="Full name">
                  <input
                    type="text"
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-3 py-2 text-[13px] transition-colors focus:outline-none"
                    style={{
                      background: T.paper,
                      border: `1px solid ${T.rule}`,
                      color: T.graphite,
                      fontFamily: SANS,
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = T.cobalt)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = T.rule)}
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
                    className="w-full px-3 py-2 text-[13px] transition-colors focus:outline-none disabled:opacity-50"
                    style={{
                      background: T.paper,
                      border: `1px solid ${T.rule}`,
                      color: T.graphite,
                      fontFamily: SANS,
                    }}
                    onFocus={(e) => {
                      if (!avatarFile) e.currentTarget.style.borderColor = T.cobalt;
                    }}
                    onBlur={(e) => (e.currentTarget.style.borderColor = T.rule)}
                  />
                </Field>

                <div className="flex items-center gap-2 pt-2">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="submit"
                    disabled={saving || uploading}
                    className="inline-flex items-center gap-2 px-4 py-2 text-[10px] tracking-[0.18em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: T.cobalt,
                      color: T.paper,
                      border: `1px solid ${T.cobalt}`,
                      fontFamily: MONO,
                      minHeight: 36,
                    }}
                    onMouseEnter={(e) => {
                      if (saving || uploading) return;
                      e.currentTarget.style.background = T.cobaltInk;
                      e.currentTarget.style.borderColor = T.cobaltInk;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = T.cobalt;
                      e.currentTarget.style.borderColor = T.cobalt;
                    }}
                  >
                    {saving || uploading ? (
                      <>
                        <span
                          className="h-3 w-3 animate-spin"
                          style={{
                            border: `1.5px solid ${T.paper}`,
                            borderTopColor: "transparent",
                            borderRadius: "50%",
                          }}
                        />
                        {uploading ? "Uploading" : "Saving"}
                      </>
                    ) : (
                      <>
                        Save changes →
                      </>
                    )}
                  </motion.button>
                  <Link
                    href="/dashboard"
                    className="px-4 py-2 text-[10px] tracking-[0.18em] uppercase transition-colors"
                    style={{
                      background: T.paper,
                      border: `1px solid ${T.rule}`,
                      color: T.graphite,
                      fontFamily: MONO,
                      minHeight: 36,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = T.graphite;
                      e.currentTarget.style.color = T.paper;
                      e.currentTarget.style.borderColor = T.graphite;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = T.paper;
                      e.currentTarget.style.color = T.graphite;
                      e.currentTarget.style.borderColor = T.rule;
                    }}
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </section>

            {/* Account Information */}
            <section
              style={{
                background: T.paper,
                border: `1px solid ${T.rule}`,
              }}
            >
              <div
                className="flex items-center justify-between border-b px-5 py-2 text-[10px] tracking-[0.16em] uppercase"
                style={{
                  background: T.vellum,
                  borderColor: T.rule,
                  color: T.muted,
                  fontFamily: MONO,
                }}
              >
                <span style={{ color: T.graphite }}>Account information</span>
                <span>Read only</span>
              </div>
              <dl
                className="divide-y px-5"
                style={{ borderColor: T.rule }}
              >
                <AccountRow
                  label="Account created"
                  value={
                    profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString()
                      : "N/A"
                  }
                />
                <AccountRow
                  label="Last updated"
                  value={
                    profile?.updated_at
                      ? new Date(profile.updated_at).toLocaleDateString()
                      : "N/A"
                  }
                />
              </dl>
            </section>

            {/* Danger Zone */}
            <section
              style={{
                background: T.paper,
                border: `1px solid ${T.error}`,
              }}
            >
              <div
                className="flex items-center justify-between border-b px-5 py-2 text-[10px] tracking-[0.16em] uppercase"
                style={{
                  background: `${T.error}10`,
                  borderColor: T.error,
                  color: T.error,
                  fontFamily: MONO,
                }}
              >
                <span>Danger · Irreversible</span>
                <span>Read carefully</span>
              </div>

              <div className="px-5">
                {/* Sign out */}
                <div
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div>
                    <div
                      className="text-[12px]"
                      style={{
                        color: T.graphite,
                        fontFamily: SANS,
                        fontWeight: 500,
                      }}
                    >
                      Sign out
                    </div>
                    <p
                      className="mt-0.5 text-[11px]"
                      style={{ color: T.muted, fontFamily: SANS }}
                    >
                      End your current session on this device.
                    </p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={handleLogout}
                    className="flex-none inline-flex items-center gap-1.5 px-3.5 py-2 text-[10px] tracking-[0.18em] uppercase transition-colors"
                    style={{
                      background: T.paper,
                      border: `1px solid ${T.rule}`,
                      color: T.graphite,
                      fontFamily: MONO,
                      minHeight: 36,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = T.graphite;
                      e.currentTarget.style.color = T.paper;
                      e.currentTarget.style.borderColor = T.graphite;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = T.paper;
                      e.currentTarget.style.color = T.graphite;
                      e.currentTarget.style.borderColor = T.rule;
                    }}
                  >
                    Sign out
                  </motion.button>
                </div>

                {/* Delete account */}
                <div
                  className="flex items-center justify-between gap-4 border-t py-4"
                  style={{ borderColor: T.rule }}
                >
                  <div>
                    <div
                      className="text-[12px]"
                      style={{
                        color: T.graphite,
                        fontFamily: SANS,
                        fontWeight: 500,
                      }}
                    >
                      Delete account
                    </div>
                    <p
                      className="mt-0.5 text-[11px]"
                      style={{ color: T.muted, fontFamily: SANS }}
                    >
                      Permanently remove your account, all projects, and all
                      data. This cannot be undone.
                    </p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setShowDeleteModal(true)}
                    className="flex-none inline-flex items-center gap-1.5 px-3.5 py-2 text-[10px] tracking-[0.18em] uppercase transition-colors"
                    style={{
                      background: T.error,
                      color: T.paper,
                      border: `1px solid ${T.error}`,
                      fontFamily: MONO,
                      minHeight: 36,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.opacity = "0.85")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = "1")
                    }
                  >
                    Delete account →
                  </motion.button>
                </div>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
      </ErrorBoundary>

      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </DashboardLayout>
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
        className="mb-1.5 block text-[10px] tracking-[0.16em] uppercase"
        style={{ color: T.muted, fontFamily: MONO }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p
          className="mt-1 text-[11px]"
          style={{ color: T.muted, fontFamily: SANS }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-2.5">
      <dt
        className="text-[10px] tracking-[0.16em] uppercase"
        style={{ color: T.muted, fontFamily: MONO }}
      >
        {label}
      </dt>
      <dd
        className="text-[12px]"
        style={{ color: T.graphite, fontFamily: SANS, fontWeight: 500 }}
      >
        {value}
      </dd>
    </div>
  );
}
