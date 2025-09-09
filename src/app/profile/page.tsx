"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiService, UserProfile } from "@/services/api";

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!apiService.isAuthenticated()) {
          router.push("/signin");
          return;
        }

        const userProfile = await apiService.getUserProfile();
        console.log('Profile data:', userProfile);
        console.log('Profile image URL:', userProfile.profileImageUrl);
        console.log('Selected frame:', userProfile.selectedFrame);
        setProfile(userProfile);
      } catch (error) {
        console.error("Profile fetch error:", error);
        setError(error instanceof Error ? error.message : "Failed to load profile");
        if (error instanceof Error && error.message.includes("Authentication failed")) {
          router.push("/signin");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  // Refresh profile data when the page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Refetch profile data when page becomes visible
        const fetchProfile = async () => {
          try {
            if (apiService.isAuthenticated()) {
              const userProfile = await apiService.getUserProfile();
              setProfile(userProfile);
            }
          } catch (error) {
            console.error("Profile refresh error:", error);
          }
        };
        fetchProfile();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleSignOut = async () => {
    await apiService.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-white mt-4">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4">
        <div className="bg-red-100 rounded-lg p-8 shadow text-red-900 text-center">
          <h2 className="text-2xl font-bold mb-4">Error Loading Profile</h2>
          <p className="mb-4">{error}</p>
          <button
            onClick={() => router.push("/signin")}
            className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition"
          >
            Sign In Again
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-white">User Profile</h1>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setLoading(true);
              apiService.getUserProfile().then(setProfile).catch(console.error).finally(() => setLoading(false));
            }}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
          >
            Refresh
          </button>
          <a href="/dashboard">
            <button
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded hover:scale-105 transition font-bold shadow"
            >
              Dashboard
            </button>
          </a>
          <button
            onClick={handleSignOut}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="bg-blue-100 rounded-lg p-8 shadow text-blue-900">
        {/* User Header */}
        <div className="flex items-center mb-8">
          <div className="relative mr-6">
            {profile.profileImageUrl ? (
              <Image
                src={profile.profileImageUrl}
                alt="Profile"
                width={80}
                height={80}
                className="rounded-full border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center text-2xl font-bold text-gray-600">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            {profile.selectedFrame && (
              <div className="absolute -inset-2 pointer-events-none">
                <Image
                  src={profile.selectedFrame.imageUrl}
                  alt={profile.selectedFrame.name}
                  width={96}
                  height={96}
                  className="w-24 h-24 object-contain"
                />
              </div>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{profile.username}</h2>
            <p className="text-blue-700">{profile.email}</p>
            <div className="flex items-center gap-4 mt-2">
              <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                Level {profile.highestLevel}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="font-bold text-lg mb-2">Currency</h3>
            <div className="space-y-1">
              <p><span className="font-semibold">Flectcoins:</span> {profile.flectcoins.toLocaleString()}</p>
              <p><span className="font-semibold">Points:</span> {profile.points.toLocaleString()}</p>
              <p><span className="font-semibold">Gems:</span> {profile.gems.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="font-bold text-lg mb-2">Game Stats</h3>
            <div className="space-y-1">
              <p><span className="font-semibold">Games Played:</span> {profile.gamesPlayed.toLocaleString()}</p>
              <p><span className="font-semibold">Top Score:</span> {profile.topScore.toLocaleString()}</p>
              <p><span className="font-semibold">Longest Word:</span> {profile.longestWord || "None"}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="font-bold text-lg mb-2">Battle Stats</h3>
            <div className="space-y-1">
              <p><span className="font-semibold">Wins:</span> {profile.battleWins}</p>
              <p><span className="font-semibold">Losses:</span> {profile.battleLosses}</p>
              <p><span className="font-semibold">Win Rate:</span> {profile.battleWins + profile.battleLosses > 0 ? Math.round((profile.battleWins / (profile.battleWins + profile.battleLosses)) * 100) : 0}%</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="font-bold text-lg mb-2">Leaderboard Achievements</h3>
            <div className="space-y-1">
              <p><span className="font-semibold">1st Place:</span> {profile.firstPlaceFinishes} 🥇</p>
              <p><span className="font-semibold">2nd Place:</span> {profile.secondPlaceFinishes} 🥈</p>
              <p><span className="font-semibold">3rd Place:</span> {profile.thirdPlaceFinishes} 🥉</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="font-bold text-lg mb-2">Words Found</h3>
            <div className="space-y-1">
              <p><span className="font-semibold">Total Words:</span> {profile.allFoundWords.length.toLocaleString()}</p>
              <p><span className="font-semibold">Longest Word:</span> {profile.longestWord || "None"}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="font-bold text-lg mb-2">Recent Activity</h3>
            <div className="space-y-1">
              <p><span className="font-semibold">Leaderboard Placements:</span> {profile.leaderboardPlacements}</p>
              <p><span className="font-semibold">Current Level:</span> {profile.highestLevel}</p>
            </div>
          </div>
        </div>

        {/* Recent Words */}
        {profile.allFoundWords.length > 0 && (
          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="font-bold text-lg mb-4">Recent Words Found</h3>
            <div className="flex flex-wrap gap-2">
              {profile.allFoundWords.slice(-10).map((item, index) => (
                <span
                  key={index}
                  className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-sm"
                >
                  {typeof item === 'string' ? item : item.word}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 