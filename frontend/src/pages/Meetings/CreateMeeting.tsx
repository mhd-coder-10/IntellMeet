// Form to create a new meeting with enterprise-grade dark UI
// Preserves React Hook Form + Zod validation and meeting navigation

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Video,
  Sparkles,
  ArrowLeft,
  Calendar,
  Shield,
  Radio,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { createMeeting } from "@/services/meetingService";
import { getErrorMessage } from "@/utils/errorHelper";

// Format date into YYYY-MM-DDTHH:mm local datetime string for input
const formatLocalDateTime = (date: Date = new Date()) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const schema = z
  .object({
    title: z.string().min(2, "Title must be at least 2 characters"),
    description: z.string().optional(),
    startTime: z.string().min(1, "Starting time is required"),
    endTime: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.endTime || !data.endTime.trim()) return true;
      return new Date(data.endTime) > new Date(data.startTime);
    },
    {
      message: "Ending time must be after starting time",
      path: ["endTime"],
    }
  );

type FormData = z.infer<typeof schema>;

export default function CreateMeeting() {
  const [isLoading, setIsLoading] = useState(false);
  const [createdMeetingId, setCreatedMeetingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      startTime: formatLocalDateTime(new Date()),
      endTime: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const meetingStartTime = new Date(data.startTime).toISOString();
      const meetingEndTime = data.endTime && data.endTime.trim() ? new Date(data.endTime).toISOString() : null;

      const meeting = await createMeeting({
        title: data.title,
        description: data.description,
        scheduledAt: meetingStartTime,
        startTime: meetingStartTime,
        endTime: meetingEndTime,
      });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting created successfully");
      setCreatedMeetingId(meeting._id);
      setIsDialogOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinNow = () => {
    if (createdMeetingId) {
      navigate(`/meetings/${createdMeetingId}`);
    }
  };

  const handleGoToDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    navigate("/meetings");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 antialiased selection:bg-blue-100">
      <Header />

      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-10 space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
          <Link to="/dashboard" className="hover:underline">Dashboard</Link>
          <span className="text-slate-400">/</span>
          <Link to="/meetings" className="hover:underline">Meetings</Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500">New Meeting</span>
        </div>

        <Card className="border-slate-200/90 bg-white text-slate-900 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shrink-0">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">
                  Create New Meeting
                </CardTitle>
                <CardDescription className="text-slate-600 text-xs mt-0.5">
                  Generate an instant room with WebRTC peer-to-peer video and MP4 composite recording.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Meeting Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-semibold text-slate-700">
                  Meeting Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="e.g. Weekly Product Sync"
                  className="bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm h-11"
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-xs text-red-500">{errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs font-semibold text-slate-700">
                  Description <span className="text-slate-500">(Optional)</span>
                </Label>
                <Input
                  id="description"
                  placeholder="e.g. Review sprint progress, roadmaps, and blockers"
                  className="bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm h-11"
                  {...register("description")}
                />
              </div>

              {/* Meeting Schedule Time (Start & End Time) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200/90 bg-slate-50/60">
                {/* Starting Time (Mandatory) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="startTime" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Starting Time <span className="text-red-500">*</span>
                    </Label>
                    <span className="text-[10px] text-slate-400 font-medium">Default: Current time</span>
                  </div>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    className="bg-white border-slate-200 focus:border-blue-500 text-slate-900 rounded-xl text-xs h-10"
                    {...register("startTime")}
                  />
                  {errors.startTime && (
                    <p className="text-xs text-red-500">{errors.startTime.message}</p>
                  )}
                </div>

                {/* Ending Time (Optional) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="endTime" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Ending Time <span className="text-slate-400 font-normal">(Optional)</span>
                    </Label>
                    <span className="text-[10px] text-slate-400 font-medium">Leave empty: Open-ended</span>
                  </div>
                  <Input
                    id="endTime"
                    type="datetime-local"
                    className="bg-white border-slate-200 focus:border-blue-500 text-slate-900 rounded-xl text-xs h-10"
                    {...register("endTime")}
                  />
                  {errors.endTime && (
                    <p className="text-xs text-red-500">{errors.endTime.message}</p>
                  )}
                </div>
              </div>

              {/* Feature Highlights Card */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50 space-y-2.5 text-xs text-slate-700">
                <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider block">
                  INCLUDED FEATURES
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Real-time Mesh WebRTC</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>MP4 Recording (Canvas Grid)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>Secure Host Controls</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>8-Character Room Code</span>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Link to="/meetings">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    Cancel
                  </Button>
                </Link>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm px-6 h-11 shadow-xs"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? "Starting Room..." : "Launch Meeting"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>

      {/* Meeting Created Action Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          // Disable closing the dialog by clicking outside or escape key
          if (!open) return;
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="bg-white border border-slate-200 text-slate-900 rounded-2xl p-6 shadow-2xl sm:max-w-md"
        >
          <DialogHeader className="text-left space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mb-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Meeting Created
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              Your meeting is ready. What would you like to do?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoToDashboard}
              className="w-full sm:w-auto rounded-xl text-xs h-10 border-slate-300 text-slate-700 hover:bg-slate-100 font-medium"
            >
              Go to Dashboard
            </Button>
            <Button
              type="button"
              onClick={handleJoinNow}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs h-10 shadow-xs"
            >
              Join Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}