import { useEffect, useState } from "react";
import { authService, UserSession } from "./services/auth";
import { apiService, UserProfile } from "./services/api";
import { AuthCard } from "./components/AuthCard";
import { ProfileCard } from "./components/ProfileCard";
import "./App.css";

export default function App() {
  const [session, setSession] = useState<UserSession | null>(() => authService.getSession());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async () => {
    if (!authService.getSession()) {
      setSession(null);
      setProfile(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getProfile();
      setProfile(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load profile from API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      loadProfile();
    }
  }, [session]);

  const handleAuthenticated = (newSession: UserSession) => {
    setSession(newSession);
  };

  const handleSignOut = () => {
    authService.signOut();
    setSession(null);
    setProfile(null);
    setError(null);
  };

  return (
    <div className="app-layout">
      <main className="main-content">
        {!session ? (
          <AuthCard onAuthenticated={handleAuthenticated} />
        ) : loading && !profile ? (
          <div className="status-container">
            <div className="spinner-large" />
            <p className="status-text">Loading your profile…</p>
          </div>
        ) : error && !profile ? (
          <div className="status-container">
            <div className="error-card">
              <h3>Unable to load profile</h3>
              <p>{error}</p>
              <button type="button" className="btn-secondary" onClick={loadProfile}>
                Try Again
              </button>
            </div>
          </div>
        ) : profile ? (
          <div className="profile-wrapper">
            <ProfileCard profile={profile} onProfileUpdated={loadProfile} />
            <div className="logout-container">
              <button type="button" className="btn-logout" onClick={handleSignOut}>
                Log Out
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
