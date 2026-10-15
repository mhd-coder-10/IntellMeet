// Join Meeting page redirecting to Workspace Meetings schedule
// Meeting code concept has been deprecated in favor of direct workspace and project invites

import { useNavigate, Link } from "react-router-dom";
import { Video, Briefcase } from "lucide-react";
import {
  Card,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function JoinMeeting() {
  const navigate = useNavigate();

  return (
    <div className="w-full">
      <main className="w-full max-w-xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
          <Link to="/dashboard" className="hover:underline">Dashboard</Link>
          <span className="text-slate-400">/</span>
          <Link to="/meetings" className="hover:underline">Meetings</Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500">Join Meeting</span>
        </div>

        <Card className="border-slate-200/90 bg-white text-slate-900 shadow-sm rounded-2xl overflow-hidden text-center p-6 sm:p-8 space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mx-auto">
            <Briefcase className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <CardTitle className="text-xl font-bold text-slate-900">
              Workspace-Based Meeting Access
            </CardTitle>
            <CardDescription className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Meeting codes are no longer required in IntellMeet. All meetings are organized through your workspaces and project boards. When a meeting is live, join directly with 1 click from your schedule.
            </CardDescription>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => navigate("/meetings")}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs px-5 h-10 shadow-xs cursor-pointer"
            >
              <Video className="w-4 h-4 mr-1.5" />
              View Your Meetings
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs px-5 h-10 cursor-pointer"
            >
              Go to Dashboard
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}