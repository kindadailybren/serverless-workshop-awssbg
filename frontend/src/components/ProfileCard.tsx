import React, { useRef, useState, useEffect } from "react";
import { apiService, UserProfile } from "../services/api";

interface ProfileCardProps {
  profile: UserProfile;
  onProfileUpdated: () => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ profile, onProfileUpdated }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile.name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(profile.name || "");
    setBio(profile.bio || "");
  }, [profile]);

  const handleStartEdit = () => {
    setName(profile.name || "");
    setBio(profile.bio || "");
    setFeedback(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setName(profile.name || "");
    setBio(profile.bio || "");
    setFeedback(null);
    setIsEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      await apiService.updateProfile({
        name: name.trim(),
        bio: bio.trim(),
      });
      setFeedback({ text: "Profile updated successfully.", type: "success" });
      setIsEditing(false);
      onProfileUpdated();
    } catch (err: any) {
      console.error(err);
      setFeedback({ text: err.message || "Failed to update profile.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFeedback({ text: "Please select an image file (JPEG, PNG, WEBP).", type: "error" });
      return;
    }

    setUploadingAvatar(true);
    setFeedback(null);

    try {
      // 1. Get presigned upload URL from API
      const { uploadUrl } = await apiService.getUploadUrl(file.type);

      // 2. Direct PUT to S3
      await apiService.uploadToS3(uploadUrl, file);

      setFeedback({ text: "Avatar updated successfully.", type: "success" });
      onProfileUpdated();
    } catch (err: any) {
      console.error(err);
      setFeedback({ text: "Failed to upload avatar. Please try again.", type: "error" });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const avatarUrl = apiService.getAvatarUrl(profile.avatarKey);

  return (
    <div className="profile-container">
      <div className={`profile-card ${isEditing ? "is-editing" : ""}`}>
        {/* Header Action: Pen Edit Icon (visible in view mode) */}
        {!isEditing && (
          <button
            type="button"
            className="edit-pen-button"
            onClick={handleStartEdit}
            title="Edit Profile"
            aria-label="Edit Profile"
          >
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span className="pen-label">Edit</span>
          </button>
        )}

        {/* Avatar Section */}
        <div className="profile-header">
          <div className="avatar-wrapper">
            {avatarUrl ? (
              <img src={avatarUrl} alt={profile.name || "Avatar"} className="avatar-img" />
            ) : (
              <div className="avatar-initials">
                {(profile.name || profile.email || "U").slice(0, 2).toUpperCase()}
              </div>
            )}

            {/* Subtle camera/pen overlay badge for instant avatar upload */}
            <button
              type="button"
              className={`avatar-badge-btn ${uploadingAvatar ? "uploading" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              title="Change avatar image"
              aria-label="Change avatar image"
            >
              {uploadingAvatar ? (
                <div className="spinner-mini" />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarSelect}
            />
          </div>

          {!isEditing && (
            <div className="profile-identity">
              <h2 className="profile-name">{profile.name || "Unnamed User"}</h2>
              <div className="profile-email-badge">
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{profile.email}</span>
              </div>
            </div>
          )}
        </div>

        {/* Feedback message */}
        {feedback && (
          <div className={`profile-feedback ${feedback.type}`}>{feedback.text}</div>
        )}

        {/* Main Body: View Mode vs In-Place Edit Mode */}
        {!isEditing ? (
          <div className="profile-body-view">
            <div className="detail-group">
              <span className="detail-label">Bio</span>
              <p className="detail-bio">
                {profile.bio ? profile.bio : <span className="text-muted">No bio added yet. Click the pen icon above to add a bio.</span>}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="profile-body-edit" noValidate>
            <div className="edit-field">
              <label htmlFor="edit-name">Display Name</label>
              <input
                id="edit-name"
                type="text"
                className="animated-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
                maxLength={80}
              />
            </div>

            <div className="edit-field">
              <label htmlFor="edit-email">Email Address</label>
              <div className="readonly-email-container">
                <input
                  id="edit-email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="input-disabled"
                />
                <span className="badge-verified">Verified</span>
              </div>
              <span className="field-hint">Managed via Amazon Cognito</span>
            </div>

            <div className="edit-field">
              <label htmlFor="edit-bio">Bio</label>
              <textarea
                id="edit-bio"
                className="animated-textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Tell us a little about yourself..."
                maxLength={400}
              />
            </div>

            <div className="edit-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
