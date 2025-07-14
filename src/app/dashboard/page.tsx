"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { apiService, UserProfile } from "@/services/api";

// Calculate points needed for next level
function calculateLevelProgress(points: number, currentLevel: number): {
  pointsToNext: number;
  progressPercentage: number;
  totalPointsForLevel: number;
} {
  // Simple level progression: each level requires more points
  const basePoints = 100; // Points needed for level 1
  const pointsForCurrentLevel = basePoints * Math.pow(1.5, currentLevel - 1);
  const pointsForNextLevel = basePoints * Math.pow(1.5, currentLevel);
  
  const pointsInCurrentLevel = points - pointsForCurrentLevel;
  const pointsNeededForNextLevel = pointsForNextLevel - pointsForCurrentLevel;
  
  const progressPercentage = Math.min((pointsInCurrentLevel / pointsNeededForNextLevel) * 100, 100);
  
  return {
    pointsToNext: Math.max(0, Math.ceil(pointsNeededForNextLevel - pointsInCurrentLevel)),
    progressPercentage,
    totalPointsForLevel: Math.ceil(pointsNeededForNextLevel)
  };
}

export default function Dashboard() {
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-black px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-white mt-4">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-black px-4 py-12">
        <div className="bg-red-100 rounded-lg p-8 shadow text-red-900 text-center">
          <h2 className="text-2xl font-bold mb-4">Error Loading Dashboard</h2>
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

  const levelProgress = calculateLevelProgress(profile.points, profile.highestLevel);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-black px-4 py-12">
      <div className="w-full max-w-xl bg-black bg-opacity-70 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-8 animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <Image src="/apple-touch-icon.png" alt="Wordflect Logo" width={64} height={64} className="rounded-lg mb-2" />
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-wide text-center">Dashboard</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              {profile.profileImageUrl ? (
                <Image
                  src={profile.profileImageUrl}
                  alt="Profile"
                  width={60}
                  height={60}
                  className="rounded-full border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-15 h-15 bg-gray-300 rounded-full flex items-center justify-center text-xl font-bold text-gray-600">
                  {profile.username.charAt(0).toUpperCase()}
                </div>
              )}
              {profile.selectedFrame && (
                <div className="absolute -inset-2">
                  <Image
                    src={profile.selectedFrame.imageUrl}
                    alt={profile.selectedFrame.name}
                    width={72}
                    height={72}
                    className="w-18 h-18"
                  />
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-lg text-blue-200 font-medium">Welcome, {profile.username}!</p>
              <p className="text-sm text-gray-300">Level {profile.highestLevel}</p>
            </div>
          </div>
          
          {/* Level Progress Bar */}
          <div className="w-full max-w-sm">
            <div className="flex justify-between text-sm text-gray-300 mb-2">
              <span>Progress to Level {profile.highestLevel + 1}</span>
              <span>{levelProgress.pointsToNext} points needed</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${levelProgress.progressPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{profile.points} points</span>
              <span>{Math.ceil(levelProgress.totalPointsForLevel)} total</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-6 w-full justify-center">
          <Link href="/play" className="flex-1">
            <div className="group bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl p-6 flex flex-col items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer min-h-[200px]">
              <Image src="/globe.svg" alt="Play Game" width={56} height={56} className="mb-3" />
              <span className="text-xl font-bold text-white mb-1">Play a Game</span>
              <span className="text-blue-100 text-sm">Start a new word search</span>
            </div>
          </Link>
          <Link href="/profile" className="flex-1">
            <div className="group bg-gradient-to-r from-green-500 to-blue-500 rounded-xl p-6 flex flex-col items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer min-h-[200px]">
              <div className="relative mb-3" style={{ width: 56, height: 56 }}>
                {profile.profileImageUrl ? (
                  <Image
                    src={profile.profileImageUrl}
                    alt="Profile"
                    width={56}
                    height={56}
                    className="rounded-full border-2 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-14 h-14 bg-gray-300 rounded-full flex items-center justify-center text-lg font-bold text-gray-600">
                    {profile.username.charAt(0).toUpperCase()}
                  </div>
                )}
                {profile.selectedFrame && (
                  <div className="absolute -inset-1">
                    <Image
                      src={profile.selectedFrame.imageUrl}
                      alt={profile.selectedFrame.name}
                      width={64}
                      height={64}
                      className="w-16 h-16"
                    />
                  </div>
                )}
              </div>
              <span className="text-xl font-bold text-white mb-1">View Profile</span>
              <span className="text-blue-100 text-sm">See your stats and achievements</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
} 