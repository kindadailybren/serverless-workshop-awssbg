import { authService } from "./auth";

const API_BASE = (import.meta.env.VITE_API_URL as string) || "";
const ASSETS_CF_BASE = (import.meta.env.VITE_ASSETS_CLOUDFRONT_URL as string) || "";

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  bio: string;
  avatarKey: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const apiService = {
  /**
   * Helper to perform authenticated fetch requests
   */
  async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error("User is not authenticated");
    }

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
      Authorization: token,
    };

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      authService.signOut();
      window.location.reload();
      throw new Error("Session expired. Please sign in again.");
    }

    return res;
  },

  /**
   * Fetch authenticated user's profile
   */
  async getProfile(): Promise<UserProfile> {
    const res = await this.request("/profile", { method: "GET" });
    if (!res.ok) {
      throw new Error(`Failed to fetch profile: ${res.status}`);
    }
    return res.json();
  },

  /**
   * Update name and bio for authenticated user
   */
  async updateProfile(data: { name: string; bio: string }): Promise<void> {
    const res = await this.request("/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to update profile: ${res.status}`);
    }
  },

  /**
   * Get presigned S3 upload URL for avatar
   */
  async getUploadUrl(contentType: string): Promise<{ uploadUrl: string; key: string }> {
    const encodedType = encodeURIComponent(contentType);
    const res = await this.request(`/profile/upload-url?contentType=${encodedType}`, {
      method: "GET",
    });

    if (!res.ok) {
      throw new Error(`Failed to get upload URL: ${res.status}`);
    }

    return res.json();
  },

  /**
   * Directly upload avatar binary to S3 using presigned PUT URL
   */
  async uploadToS3(uploadUrl: string, file: File): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to upload avatar to S3: ${res.status}`);
    }
  },

  /**
   * Build the dedicated Assets CloudFront URL for a given avatar key
   */
  getAvatarUrl(avatarKey: string | null): string | null {
    if (!avatarKey) return null;
    if (avatarKey.startsWith("http://") || avatarKey.startsWith("https://")) {
      return avatarKey;
    }
    const cleanBase = ASSETS_CF_BASE.replace(/\/$/, "");
    const cleanKey = avatarKey.replace(/^\//, "");
    return cleanBase ? `${cleanBase}/${cleanKey}` : null;
  },
};
