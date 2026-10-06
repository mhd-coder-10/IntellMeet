// User Profile Management Page
// Complete CRUD for user information, avatar photo upload/removal, and password security
// Fully responsive desktop & mobile layout with modern slate aesthetic

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  User as UserIcon,
  Mail,
  AtSign,
  Camera,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  Video,
  Loader2,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthStore } from "@/store/authStore";
import {
  getUserProfile,
  updateUserProfile,
  uploadAvatar,
  deleteAvatar,
  changePassword,
} from "@/services/userService";
import { getErrorMessage } from "@/utils/errorHelper";
import { Link } from "react-router-dom";

export default function Profile() {
  const queryClient = useQueryClient();
  const { user: authUser, setUser } = useAuthStore();

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<"general" | "security">("general");

  // Profile Form State
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Avatar Upload State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Fetch latest profile from backend
  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
    staleTime: 60 * 1000,
  });

  // Populate form fields when data loads
  useEffect(() => {
    const u = profileData || authUser;
    if (u) {
      setName(u.name || "");
      setUsername(u.username || "");
      setBio(u.bio || "");
    }
  }, [profileData, authUser]);

  // Mutation: Update Profile Details (Name, Username, Bio)
  const profileMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.setQueryData(["userProfile"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast.success("Profile updated successfully!");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Mutation: Upload Avatar Photo
  const avatarUploadMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.setQueryData(["userProfile"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setAvatarPreview(null);
      toast.success("Profile photo updated successfully!");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setAvatarPreview(null);
    },
    onSettled: () => {
      setIsUploadingAvatar(false);
    },
  });

  // Mutation: Remove Avatar
  const avatarRemoveMutation = useMutation({
    mutationFn: deleteAvatar,
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.setQueryData(["userProfile"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setAvatarPreview(null);
      toast.success("Profile photo removed!");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Mutation: Change Password
  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: (res) => {
      toast.success(res.message || "Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Handle Profile Update Submission
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    if (!username.trim()) {
      toast.error("Username cannot be empty");
      return;
    }
    profileMutation.mutate({
      name: name.trim(),
      username: username.trim(),
      bio: bio.trim(),
    });
  };

  // Handle File Input Change (Avatar)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    setIsUploadingAvatar(true);
    avatarUploadMutation.mutate(file);
  };

  // Handle Avatar Delete
  const handleRemoveAvatar = () => {
    if (!profileData?.profilePicture && !authUser?.profilePicture) {
      toast.error("No profile picture to remove");
      return;
    }
    if (confirm("Are you sure you want to remove your profile photo?")) {
      avatarRemoveMutation.mutate();
    }
  };

  // Handle Password Update Submission
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("New password must be different from current password");
      return;
    }

    passwordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  const activeUser = profileData || authUser;
  const initials = (activeUser?.name || "User")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const currentAvatarSrc =
    avatarPreview || activeUser?.profilePicture || null;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 antialiased selection:bg-blue-100">
      <Header />

      <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold mb-1">
              <Link to="/dashboard" className="hover:underline">Dashboard</Link>
              <span>/</span>
              <span className="text-slate-500">Account Profile</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              Profile Management
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                {activeUser?.role === "admin" ? "Admin" : "Team Member"}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage your personal information, profile photo, and account security.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/meetings">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded-xl"
              >
                <Video className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                My Meetings
              </Button>
            </Link>
          </div>
        </div>

        {/* Hero Banner with Avatar & Identity */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white p-5 sm:p-8 shadow-xs">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-indigo-400/10 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar Section */}
            <div className="relative group shrink-0">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-4 border-white bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-700 flex items-center justify-center text-white text-3xl font-extrabold shadow-md shadow-blue-500/15 transition-transform group-hover:scale-[1.02]">
                {currentAvatarSrc ? (
                  <img
                    src={currentAvatarSrc}
                    alt={activeUser?.name || "Avatar"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}

                {/* Upload Overlay spinner */}
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white text-xs gap-1.5">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    <span>Uploading...</span>
                  </div>
                )}
              </div>

              {/* Quick Camera Overlay Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md border border-white transition transform active:scale-95 cursor-pointer"
                title="Change Photo"
              >
                <Camera className="w-4 h-4" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Profile Info Details */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {activeUser?.name || "User"}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-mono inline-block shadow-xs">
                  @{activeUser?.username || "username"}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
                {activeUser?.bio || "No bio added yet. Add a short summary about yourself below."}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>{activeUser?.email}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Profile Photo: Active</span>
                </div>
              </div>

              {/* Action Buttons for Avatar */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-3">
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl shadow-sm shadow-blue-500/20"
                >
                  <Camera className="w-3.5 h-3.5 mr-1.5" />
                  {isUploadingAvatar ? "Uploading Photo..." : "Upload New Photo"}
                </Button>

                {activeUser?.profilePicture && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={avatarRemoveMutation.isPending}
                    className="border-slate-300 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-slate-700 text-xs rounded-xl"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    {avatarRemoveMutation.isPending ? "Removing..." : "Remove Photo"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer ${
              activeTab === "general"
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserIcon className="w-4 h-4" />
            General Information
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer ${
              activeTab === "security"
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Password & Security
          </button>
        </div>

        {/* Tab 1: General Profile Details Form */}
        {activeTab === "general" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="border-slate-200/90 bg-white text-slate-900 shadow-xs rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-blue-600" />
                    Personal Details
                  </CardTitle>
                  <CardDescription className="text-slate-500 text-xs">
                    Update your display name, username, and profile bio.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileSubmit} className="space-y-5">
                    {/* Full Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
                        Full Name
                      </Label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your Name"
                          className="pl-9 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm"
                          required
                        />
                      </div>
                    </div>

                    {/* Username */}
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-xs font-semibold text-slate-700">
                        Username
                      </Label>
                      <div className="relative">
                        <AtSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <Input
                          id="username"
                          value={username}
                          onChange={(e) =>
                            setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                          }
                          placeholder="username"
                          className="pl-9 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm font-mono"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Only lowercase letters, numbers, and underscores are allowed.
                      </p>
                    </div>

                    {/* Email (Readonly) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                          Email Address
                        </Label>
                        <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      </div>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <Input
                          id="email"
                          value={activeUser?.email || ""}
                          disabled
                          className="pl-9 bg-slate-100 border-slate-200 text-slate-500 rounded-xl text-sm cursor-not-allowed"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Email cannot be changed directly for account security.
                      </p>
                    </div>

                    {/* Bio */}
                    <div className="space-y-2">
                      <Label htmlFor="bio" className="text-xs font-semibold text-slate-700">
                        Bio / Status
                      </Label>
                      <div className="relative">
                        <textarea
                          id="bio"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          maxLength={300}
                          rows={4}
                          placeholder="Tell your team about yourself, your department, or role..."
                          className="w-full p-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm transition resize-none"
                        />
                      </div>
                      <div className="flex justify-end">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {bio.length}/300
                        </span>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={profileMutation.isPending || isProfileLoading}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 font-medium rounded-xl shadow-sm shadow-blue-500/20 text-sm h-11"
                      >
                        {profileMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving Changes...
                          </>
                        ) : (
                          "Save Profile Changes"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Side Card: Account Summary */}
            <div className="space-y-6">
              <Card className="border-slate-200/90 bg-white text-slate-900 shadow-xs rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Account Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-700">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                      Account Status
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">Active</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-semibold">
                        Verified Member
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                      Workspace Role
                    </span>
                    <p className="font-semibold text-slate-900 capitalize">
                      {activeUser?.role || "Member"}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      Full permissions to create, record, and join meetings.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Tab 2: Password & Security */}
        {activeTab === "security" && (
          <div className="max-w-2xl">
            <Card className="border-slate-200/90 bg-white text-slate-900 shadow-xs rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-blue-600" />
                  Update Password
                </CardTitle>
                <CardDescription className="text-slate-500 text-xs">
                  Ensure your account uses a strong password with at least 6 characters.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  {/* Current Password */}
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-xs font-semibold text-slate-700">
                      Current Password
                    </Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="pl-9 pr-10 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-xs font-semibold text-slate-700">
                      New Password
                    </Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter at least 6 characters"
                        className="pl-9 pr-10 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <Input
                        id="confirmPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="pl-9 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm"
                        required
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-3">
                    <Button
                      type="submit"
                      disabled={passwordMutation.isPending}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 font-medium rounded-xl shadow-sm shadow-blue-500/20 text-sm h-11"
                    >
                      {passwordMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        "Update Password"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
