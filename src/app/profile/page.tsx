"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

  // Form state
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
      // Validate file type
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

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: "error", text: "Image size must be less than 5MB" });
        return;
      }

      setAvatarFile(file);
      // Create preview URL
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
      // Don't set message here - let the outer handler deal with it
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

      // Upload image if a new file was selected
      if (avatarFile) {
        try {
          finalAvatarUrl = await handleUploadImage();
          if (!finalAvatarUrl) {
            throw new Error("Failed to upload image");
          }
        } catch (uploadError) {
          // Handle upload error specifically
          const errorMsg =
            uploadError instanceof Error
              ? uploadError.message
              : "Failed to upload image";
          setMessage({ type: "error", text: errorMsg });
          setSaving(false);
          return; // Stop here, don't try to update profile
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

      // Refresh the page to update user data in other components
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
      <div className="flex h-screen items-center justify-center bg-[#0A0A0A]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#2E2E2E] border-t-[#FF6B00]" />
          <p className="text-sm text-[#A0A0A0]">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <header className="border-b border-[#2E2E2E] bg-[#1A1A1A]">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-white transition-colors hover:text-[#FF6B00]"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span className="text-sm font-medium">Back to Dashboard</span>
              </Link>
            </div>
            <Link href="/dashboard" className="flex items-center gap-2">
              <img src="/logo.png" alt="CodeCanvas Logo" className="h-8 w-8" />
              <span className="text-lg font-bold text-white">CodeCanvas</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
          <p className="mt-2 text-sm text-[#A0A0A0]">
            Manage your account information and preferences
          </p>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 ${
              message.type === "success"
                ? "border-green-500/50 bg-green-500/10 text-green-400"
                : "border-red-500/50 bg-red-500/10 text-red-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === "success" ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              <span className="text-sm font-medium">{message.text}</span>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Profile Information Card */}
          <div className="rounded-lg border border-[#2E2E2E] bg-[#1A1A1A] p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Personal Information
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar Preview */}
              <div className="flex items-start gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white overflow-hidden relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="h-20 w-20 rounded-full object-cover"
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
                  <h3 className="text-lg font-medium text-white mb-2">
                    Profile Picture
                  </h3>
                  <p className="text-sm text-[#A0A0A0] mb-3">
                    Upload an image or enter a URL below
                  </p>
                  <label
                    htmlFor="avatar-upload"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#2E2E2E] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#3E3E3E] cursor-pointer"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {avatarFile ? avatarFile.name : "Choose Image"}
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <p className="mt-2 text-xs text-[#666666]">
                    Max size: 5MB. Formats: JPEG, PNG, GIF, WebP
                  </p>
                </div>
              </div>

              {/* Email (Read-only) */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-white"
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={profile?.email || ""}
                  disabled
                  className="w-full rounded-lg border border-[#2E2E2E] bg-[#0A0A0A] px-4 py-2.5 text-[#A0A0A0] cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-[#666666]">
                  Email cannot be changed
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-medium text-white"
                >
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full rounded-lg border border-[#2E2E2E] bg-[#0A0A0A] px-4 py-2.5 text-white placeholder-[#666666] focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]/30"
                />
              </div>

              {/* Avatar URL */}
              <div>
                <label
                  htmlFor="avatarUrl"
                  className="mb-2 block text-sm font-medium text-white"
                >
                  Avatar URL (Optional)
                </label>
                <input
                  type="url"
                  id="avatarUrl"
                  value={avatarUrl}
                  onChange={(e) => {
                    setAvatarUrl(e.target.value);
                    setAvatarFile(null); // Clear file if URL is entered
                  }}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full rounded-lg border border-[#2E2E2E] bg-[#0A0A0A] px-4 py-2.5 text-white placeholder-[#666666] focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]/30"
                  disabled={!!avatarFile}
                />
                <p className="mt-1 text-xs text-[#666666]">
                  {avatarFile
                    ? "Clear uploaded file to enter a URL"
                    : "Or enter a URL to an image for your profile picture"}
                </p>
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="flex items-center gap-2 rounded-lg bg-[#FF6B00] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#E66000] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving || uploading ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      {uploading ? "Uploading..." : "Saving..."}
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
                <Link
                  href="/dashboard"
                  className="rounded-lg border border-[#2E2E2E] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#2E2E2E]"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>

          {/* Account Information */}
          <div className="rounded-lg border border-[#2E2E2E] bg-[#1A1A1A] p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Account Information
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#A0A0A0]">Account Created</span>
                <span className="text-white">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0A0A0]">Last Updated</span>
                <span className="text-white">
                  {profile?.updated_at
                    ? new Date(profile.updated_at).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6">
            <h2 className="mb-2 text-xl font-semibold text-red-400">
              Danger Zone
            </h2>
            <p className="mb-4 text-sm text-[#A0A0A0]">
              Signing out will end your current session
            </p>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/30"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
