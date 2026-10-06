// Allows user to join an active meeting room by entering a meeting code
// Preserves code lookup, membership joining, and room navigation

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Search, ArrowLeft, KeyRound, Info } from "lucide-react";
import { Header } from "@/components/common/Header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMeetingByCode, joinMeeting } from "@/services/meetingService";
import { getErrorMessage } from "@/utils/errorHelper";

export default function JoinMeeting() {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      toast.error("Please enter a meeting code");
      return;
    }

    setIsLoading(true);
    try {
      const meeting = await getMeetingByCode(cleanCode);
      await joinMeeting(meeting._id);
      toast.success("Joined meeting successfully!");
      navigate(`/meetings/${meeting._id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 antialiased selection:bg-blue-100">
      <Header />

      <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-10 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
          <Link to="/dashboard" className="hover:underline">Dashboard</Link>
          <span className="text-slate-400">/</span>
          <Link to="/meetings" className="hover:underline">Meetings</Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500">Join Meeting</span>
        </div>

        <Card className="border-slate-200/90 bg-white text-slate-900 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/70 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">
              Join a Meeting
            </CardTitle>
            <CardDescription className="text-slate-600 text-xs mt-1 max-w-xs mx-auto">
              Enter the 8-character meeting invitation code provided by the meeting host.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleJoin} className="space-y-6">
              <div className="space-y-2 text-center">
                <Label htmlFor="code" className="text-xs font-semibold text-slate-700">
                  Meeting Code
                </Label>
                <div className="relative max-w-xs mx-auto">
                  <Input
                    id="code"
                    placeholder="ABC12345"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                    }
                    className="font-mono tracking-widest text-center text-xl font-bold h-13 bg-slate-50 border-slate-200 focus:bg-white focus:border-emerald-500 text-slate-900 rounded-xl placeholder:text-slate-400"
                    maxLength={10}
                    required
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-500 pt-1">
                  Example: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-700 border border-slate-200 font-mono text-xs">ABC12345</code> or <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-700 border border-slate-200 font-mono text-xs">ROOM8888</code>
                </p>
              </div>

              {/* Informational Box */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50 flex items-start gap-3 text-xs text-slate-600">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-slate-600">
                  You will enter the conference room with your current display name and profile photo. You can toggle your microphone and camera at any time.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Link to="/meetings">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    Back
                  </Button>
                </Link>

                <Button
                  type="submit"
                  disabled={isLoading || !code.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm px-6 h-11 shadow-xs"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Join Room
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}