// Email notification service for meeting events (Create, Update, Cancel, End)
// Sends responsive HTML emails with meeting details, workspace context and deep links

const nodemailer = require("nodemailer");

// Initialize fresh robust Nodemailer transporter matching working Portfolio/Novise pattern
const createRawTransporter = () => {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 465;
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || "intellmeett16@gmail.com").trim();
  const rawPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || "vxrcbafkjrkofhyo";
  const pass = rawPass.trim().replace(/\s+/g, "");

  if (user.endsWith("@gmail.com") || host.includes("gmail")) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 3000,
      greetingTimeout: 3000,
      socketTimeout: 3500,
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 3000,
    greetingTimeout: 3000,
    socketTimeout: 3500,
  });
};

// Unified email dispatch: supports HTTP API (Brevo / Resend over Port 443) and direct SMTP
const sendMailUnified = async (opts) => {
  const to = opts.to;
  const subject = opts.subject;
  const html = opts.html;
  const text = opts.text || "";

  // 1. Brevo HTTP API (Port 443 / HTTPS - bypasses cloud free-tier SMTP port blocking)
  if (process.env.BREVO_API_KEY) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "api-key": process.env.BREVO_API_KEY.trim(),
        },
        body: JSON.stringify({
          sender: {
            name: "IntellMeet",
            email: process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || "intellmeett16@gmail.com",
          },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        console.log(`[Email Service - Brevo HTTP] Email sent to ${to}:`, data.messageId || "ok");
        return { messageId: data.messageId || "brevo-" + Date.now() };
      } else {
        const errData = await response.json().catch(() => ({}));
        console.warn(`[Email Service - Brevo HTTP] API returned status ${response.status}:`, errData);
      }
    } catch (httpErr) {
      console.warn(`[Email Service - Brevo HTTP] Dispatch error:`, httpErr.message);
    }
  }

  // 2. Resend HTTP API (Port 443 / HTTPS - bypasses cloud free-tier SMTP port blocking)
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "IntellMeet <onboarding@resend.dev>",
          to: [to],
          subject,
          html,
          text,
        }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        console.log(`[Email Service - Resend HTTP] Email sent to ${to}:`, data.id || "ok");
        return { messageId: data.id || "resend-" + Date.now() };
      } else {
        const errData = await response.json().catch(() => ({}));
        console.warn(`[Email Service - Resend HTTP] API returned status ${response.status}:`, errData);
      }
    } catch (httpErr) {
      console.warn(`[Email Service - Resend HTTP] Dispatch error:`, httpErr.message);
    }
  }

  // 3. Direct Nodemailer SMTP (with 3.5s timeout so Render free-tier firewall never blocks the server)
  const transporter = createRawTransporter();
  const info = await Promise.race([
    transporter.sendMail({
      from: opts.from || getFromAddress(),
      to,
      subject,
      text,
      html,
    }),
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "SMTP connection timed out. (Render Free Tier blocks outbound ports 25, 465, and 587. Configure BREVO_API_KEY or RESEND_API_KEY on Port 443 for direct cloud delivery)"
            )
          ),
        3500
      )
    ),
  ]);

  return info;
};

// Returns transporter interface compatible with all existing callers
const getTransporter = () => {
  return {
    sendMail: sendMailUnified,
  };
};

const getClientBaseUrl = () => {
  return process.env.CLIENT_URL || "http://localhost:5173";
};

// Returns authorized sender address matching configured SMTP credentials
const getFromAddress = () => {
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || "intellmeett16@gmail.com").trim();
  return process.env.EMAIL_FROM || `"IntellMeet" <${user}>`;
};




// Formats date and time into readable string (e.g., "Wednesday, Oct 14, 2026 at 7:30 PM")
const formatDateTime = (date) => {
  if (!date) return "Not specified";
  try {
    const d = new Date(date);
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(date);
  }
};

// Generates branded email wrapper
const renderEmailHtml = ({
  headerTitle,
  headerBadge,
  greeting,
  mainText,
  detailsList,
  ctaText,
  ctaUrl,
  accentColor = "#2563eb",
}) => {
  const detailsHtml = detailsList
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 0; color: #64748b; font-size: 13px; font-weight: 600; width: 35%;">${item.label}:</td>
        <td style="padding: 10px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${item.value}</td>
      </tr>
    `
    )
    .join("");

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${headerTitle}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #334155;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <!-- Top Brand Bar -->
        <tr>
          <td style="background: linear-gradient(135deg, #2563eb, #4f46e5, #9333ea); padding: 24px 32px; text-align: left;">
            <table width="100%">
              <tr>
                <td>
                  <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Intell<span style="color: #bfdbfe;">Meet</span></span>
                  <span style="display: block; font-size: 11px; color: #e0e7ff; margin-top: 2px;">Workspace Video Collaboration</span>
                </td>
                ${headerBadge
      ? `<td align="right"><span style="background-color: rgba(255,255,255,0.2); color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase;">${headerBadge}</span></td>`
      : ""
    }
              </tr>
            </table>
          </td>
        </tr>

        <!-- Content Body -->
        <tr>
          <td style="padding: 32px;">
            <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">${greeting}</h2>
            <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">${mainText}</p>

            <!-- Details Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 28px;">
              ${detailsHtml}
            </table>

            <!-- Call to Action Button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${ctaUrl}" style="display: inline-block; background-color: ${accentColor}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 10px; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
                    ${ctaText} →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin: 28px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
              You received this email because you are a participant in this workspace meeting.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px; text-align: center; font-size: 11px; color: #94a3b8;">
            © ${new Date().getFullYear()} IntellMeet. All rights reserved.
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};

// Send Meeting Created / Invitation Email
const sendMeetingInviteEmail = async ({
  recipientEmail,
  recipientName,
  meeting,
  hostName,
  workspaceName,
  projectName,
}) => {
  if (!recipientEmail) return;

  try {
    const t = await getTransporter();
    const clientBaseUrl = getClientBaseUrl();
    const meetingUrl = `${clientBaseUrl}/meetings/${meeting._id}/details`;

    const detailsList = [
      { label: "Meeting Title", value: meeting.title },
      { label: "Host", value: hostName || "Workspace Member" },
      { label: "Date & Start Time", value: formatDateTime(meeting.startTime || meeting.scheduledAt) },
      { label: "End Time", value: meeting.endTime ? formatDateTime(meeting.endTime) : "Open-ended" },
    ];

    if (workspaceName) {
      detailsList.push({ label: "Workspace", value: workspaceName });
    }

    if (projectName) {
      detailsList.push({ label: "Project", value: projectName });
    }

    const participantsCount = Array.isArray(meeting.participants)
      ? meeting.participants.length
      : 1;
    detailsList.push({ label: "Total Participants", value: `${participantsCount} members invited` });

    const html = renderEmailHtml({
      headerTitle: `Meeting Invitation: ${meeting.title}`,
      headerBadge: "New Meeting",
      greeting: `Hello ${recipientName || "there"},`,
      mainText: `You have been invited to an upcoming workspace meeting by <strong>${hostName || "your team member"}</strong>. Check the meeting schedule details below and click the button to view the meeting:`,
      detailsList,
      ctaText: "View Meeting Details",
      ctaUrl: meetingUrl,
      accentColor: "#2563eb",
    });

    const fromAddress = getFromAddress();

    await t.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject: `📅 Meeting Invitation: "${meeting.title}"`,
      html,
    });
    console.log(`[Email Service] Meeting invite email sent successfully to ${recipientEmail}`);
  } catch (err) {
    console.error(`[Email Service] Failed to send meeting invite email to ${recipientEmail}:`, err.message);
  }
};

// Send Workspace Member Added / Invitation Email
const sendWorkspaceInviteEmail = async ({
  recipientEmail,
  recipientName,
  team,
  inviterName,
  role = "member",
}) => {
  if (!recipientEmail) return;

  try {
    const t = await getTransporter();
    const clientBaseUrl = getClientBaseUrl();
    const workspaceUrl = `${clientBaseUrl}/teams/${team._id}`;

    const detailsList = [
      { label: "Workspace Name", value: team.name },
      { label: "Invited By", value: inviterName || "Workspace Admin" },
      { label: "Your Role", value: role === "admin" ? "Admin" : "Member" },
    ];

    if (team.description) {
      detailsList.push({ label: "Description", value: team.description });
    }

    if (team.code) {
      detailsList.push({ label: "Workspace Code", value: team.code });
    }

    const membersCount = Array.isArray(team.members) ? team.members.length : 1;
    detailsList.push({ label: "Team Members", value: `${membersCount} members` });

    const html = renderEmailHtml({
      headerTitle: `Added to Workspace: ${team.name}`,
      headerBadge: "Workspace Invite",
      greeting: `Hello ${recipientName || "there"},`,
      mainText: `You have been added to the workspace <strong>"${team.name}"</strong> by <strong>${inviterName || "a workspace admin"}</strong> as an <strong>${role === "admin" ? "Admin" : "Member"}</strong>. Click below to open and access your workspace directly:`,
      detailsList,
      ctaText: "Open Workspace",
      ctaUrl: workspaceUrl,
      accentColor: "#4f46e5",
    });

    const fromAddress = getFromAddress();

    await t.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject: `🏢 You've been added to Workspace: "${team.name}"`,
      html,
    });
    console.log(`[Email Service] Workspace invitation email sent successfully to ${recipientEmail}`);
  } catch (err) {
    console.error(`[Email Service] Failed to send workspace invite email to ${recipientEmail}:`, err.message);
  }
};

// Send Meeting Updated Email
const sendMeetingUpdatedEmail = async ({
  recipientEmail,
  recipientName,
  meeting,
  hostName,
  workspaceName,
  projectName,
  changesSummary,
}) => {
  if (!recipientEmail) return;

  try {
    const t = await getTransporter();
    const clientBaseUrl = getClientBaseUrl();
    const meetingUrl = `${clientBaseUrl}/meetings/${meeting._id}/details`;

    const detailsList = [
      { label: "Meeting Title", value: meeting.title },
      { label: "Host", value: hostName || "Host" },
      { label: "Updated Start Time", value: formatDateTime(meeting.startTime || meeting.scheduledAt) },
      { label: "End Time", value: meeting.endTime ? formatDateTime(meeting.endTime) : "Open-ended" },
      { label: "Workspace", value: workspaceName || "General Workspace" },
    ];

    if (projectName) {
      detailsList.push({ label: "Project", value: projectName });
    }

    const html = renderEmailHtml({
      headerTitle: `Updated: ${meeting.title}`,
      headerBadge: "Meeting Updated",
      greeting: `Hello ${recipientName || "there"},`,
      mainText: `The details for meeting <strong>"${meeting.title}"</strong> have been updated by <strong>${hostName}</strong>.${changesSummary ? ` (${changesSummary})` : ""
        } Please review the updated schedule below:`,
      detailsList,
      ctaText: "View Updated Meeting",
      ctaUrl: meetingUrl,
      accentColor: "#f59e0b",
    });

    await t.sendMail({
      from: getFromAddress(),
      to: recipientEmail,
      subject: `🔄 Meeting Details Updated: "${meeting.title}"`,
      html,
    });
  } catch (err) {
    console.warn(`Failed to send meeting update email to ${recipientEmail}:`, err.message);
  }
};

// Send Meeting Cancelled Email
const sendMeetingCancelledEmail = async ({
  recipientEmail,
  recipientName,
  meeting,
  hostName,
  workspaceName,
}) => {
  if (!recipientEmail) return;

  try {
    const t = await getTransporter();
    const clientBaseUrl = getClientBaseUrl();
    const dashboardUrl = `${clientBaseUrl}/dashboard`;

    const detailsList = [
      { label: "Cancelled Meeting", value: meeting.title },
      { label: "Host", value: hostName || "Host" },
      { label: "Scheduled Time", value: formatDateTime(meeting.startTime || meeting.scheduledAt) },
      { label: "Workspace", value: workspaceName || "General Workspace" },
    ];

    const html = renderEmailHtml({
      headerTitle: `Cancelled: ${meeting.title}`,
      headerBadge: "Cancelled",
      greeting: `Hello ${recipientName || "there"},`,
      mainText: `The meeting <strong>"${meeting.title}"</strong> has been cancelled by host <strong>${hostName}</strong>. This event has been removed from your active schedule.`,
      detailsList,
      ctaText: "Go to Dashboard",
      ctaUrl: dashboardUrl,
      accentColor: "#ef4444",
    });

    await t.sendMail({
      from: getFromAddress(),
      to: recipientEmail,
      subject: `❌ Meeting Cancelled: "${meeting.title}"`,
      html,
    });
  } catch (err) {
    console.warn(`Failed to send meeting cancellation email to ${recipientEmail}:`, err.message);
  }
};

// Send Meeting Ended Email with AI Summary Link
const sendMeetingEndedEmail = async ({
  recipientEmail,
  recipientName,
  meeting,
  hostName,
  workspaceName,
}) => {
  if (!recipientEmail) return;

  try {
    const t = await getTransporter();
    const clientBaseUrl = getClientBaseUrl();
    const meetingUrl = `${clientBaseUrl}/meetings/${meeting._id}/details`;

    const detailsList = [
      { label: "Meeting Title", value: meeting.title },
      { label: "Host", value: hostName || "Host" },
      { label: "Date", value: formatDateTime(meeting.startedAt || meeting.startTime) },
      { label: "Status", value: "Completed" },
    ];

    const html = renderEmailHtml({
      headerTitle: `Completed: ${meeting.title}`,
      headerBadge: "Summary Ready",
      greeting: `Hello ${recipientName || "there"},`,
      mainText: `The meeting <strong>"${meeting.title}"</strong> has ended. The recording, transcript, and AI meeting summary are now available on your dashboard.`,
      detailsList,
      ctaText: "View Meeting Summary & Recording",
      ctaUrl: meetingUrl,
      accentColor: "#10b981",
    });

    await t.sendMail({
      from: getFromAddress(),
      to: recipientEmail,
      subject: `📋 Meeting Summary & Recording: "${meeting.title}"`,
      html,
    });
  } catch (err) {
    console.warn(`Failed to send meeting ended email to ${recipientEmail}:`, err.message);
  }
};

// Send Meeting Expired Email
const sendMeetingExpiredEmail = async ({
  recipientEmail,
  recipientName,
  meeting,
  hostName,
  workspaceName,
}) => {
  if (!recipientEmail) return;

  try {
    const t = await getTransporter();
    const clientBaseUrl = getClientBaseUrl();
    const dashboardUrl = `${clientBaseUrl}/dashboard`;

    const detailsList = [
      { label: "Expired Meeting", value: meeting.title },
      { label: "Host", value: hostName || "Host" },
      { label: "Scheduled Time", value: formatDateTime(meeting.startTime || meeting.scheduledAt) },
      { label: "Workspace", value: workspaceName || "General Workspace" },
      { label: "Status", value: "Expired (Not Conducted)" },
    ];

    const html = renderEmailHtml({
      headerTitle: `Expired: ${meeting.title}`,
      headerBadge: "Expired",
      greeting: `Hello ${recipientName || "there"},`,
      mainText: `The scheduled meeting <strong>"${meeting.title}"</strong> has expired because it was not started by the scheduled time. It has been moved to your past meetings archive.`,
      detailsList,
      ctaText: "Go to Dashboard",
      ctaUrl: dashboardUrl,
      accentColor: "#f59e0b",
    });

    await t.sendMail({
      from: getFromAddress(),
      to: recipientEmail,
      subject: `⚠️ Meeting Expired: "${meeting.title}"`,
      html,
    });
  } catch (err) {
    console.warn(`Failed to send meeting expired email to ${recipientEmail}:`, err.message);
  }
};

// Send Workspace Join Request Accepted Email
const sendWorkspaceJoinRequestAcceptedEmail = async ({
  recipientEmail,
  recipientName,
  team,
}) => {
  if (!recipientEmail) return;

  try {
    const t = await getTransporter();
    const clientBaseUrl = getClientBaseUrl();
    const workspaceUrl = `${clientBaseUrl}/teams/${team._id}`;

    const detailsList = [
      { label: "Workspace Name", value: team.name },
      { label: "Workspace Code", value: team.code || "N/A" },
      { label: "Your Role", value: "Member" },
      { label: "Status", value: "Active" },
    ];

    const html = renderEmailHtml({
      headerTitle: `Welcome to ${team.name}`,
      headerBadge: "Join Request Approved",
      greeting: `Hello ${recipientName || "there"},`,
      mainText: `Great news! Your request to join the workspace <strong>"${team.name}"</strong> has been approved. You now have full access to workspace meetings, project boards, and team resources.`,
      detailsList,
      ctaText: "Open Workspace",
      ctaUrl: workspaceUrl,
      accentColor: "#10b981",
    });

    await t.sendMail({
      from: getFromAddress(),
      to: recipientEmail,
      subject: `🎉 Workspace Join Request Approved: "${team.name}"`,
      html,
    });
  } catch (err) {
    console.warn(`Failed to send join request approval email to ${recipientEmail}:`, err.message);
  }
};

// Send Workspace Member Role Updated Email
const sendWorkspaceRoleUpdatedEmail = async ({
  recipientEmail,
  recipientName,
  team,
  newRole,
  updatedByName,
}) => {
  if (!recipientEmail) return;

  try {
    const t = await getTransporter();
    const clientBaseUrl = getClientBaseUrl();
    const workspaceUrl = `${clientBaseUrl}/teams/${team._id}`;
    const roleTitle = newRole === "admin" ? "Workspace Admin" : "Team Member";

    const detailsList = [
      { label: "Workspace", value: team.name },
      { label: "New Role", value: roleTitle },
      { label: "Updated By", value: updatedByName || "Workspace Administrator" },
      { label: "Permissions", value: newRole === "admin" ? "Full administrative & member management access" : "Standard workspace collaboration access" },
    ];

    const html = renderEmailHtml({
      headerTitle: `Role Updated: ${team.name}`,
      headerBadge: "Role Updated",
      greeting: `Hello ${recipientName || "there"},`,
      mainText: `Your membership role in the workspace <strong>"${team.name}"</strong> has been updated to <strong>${roleTitle}</strong> by ${updatedByName || "an administrator"}.`,
      detailsList,
      ctaText: "Go to Workspace",
      ctaUrl: workspaceUrl,
      accentColor: "#6366f1",
    });

    await t.sendMail({
      from: getFromAddress(),
      to: recipientEmail,
      subject: `🛡️ Workspace Role Updated: ${roleTitle} in "${team.name}"`,
      html,
    });
  } catch (err) {
    console.warn(`Failed to send role update email to ${recipientEmail}:`, err.message);
  }
};

// Send Workspace Member Removed Email
const sendWorkspaceRemovedEmail = async ({
  recipientEmail,
  recipientName,
  team,
  removedByName,
}) => {
  if (!recipientEmail) return;

  try {
    const t = await getTransporter();
    const clientBaseUrl = getClientBaseUrl();
    const dashboardUrl = `${clientBaseUrl}/dashboard`;

    const detailsList = [
      { label: "Workspace", value: team.name },
      { label: "Action", value: "Membership Ended" },
      { label: "Removed By", value: removedByName || "Workspace Administrator" },
    ];

    const html = renderEmailHtml({
      headerTitle: `Removed from Workspace`,
      headerBadge: "Notice",
      greeting: `Hello ${recipientName || "there"},`,
      mainText: `You have been removed from the workspace <strong>"${team.name}"</strong> by ${removedByName || "an administrator"}. You will no longer receive updates or have access to this workspace's private meetings and projects.`,
      detailsList,
      ctaText: "Go to Dashboard",
      ctaUrl: dashboardUrl,
      accentColor: "#ef4444",
    });

    await t.sendMail({
      from: getFromAddress(),
      to: recipientEmail,
      subject: `ℹ️ Notice: Removed from workspace "${team.name}"`,
      html,
    });
  } catch (err) {
    console.warn(`Failed to send workspace removal email to ${recipientEmail}:`, err.message);
  }
};

// Send Signup Email Verification OTP
const sendSignupOtpEmail = async ({
  recipientEmail,
  recipientName,
  otp,
}) => {
  if (!recipientEmail) return;

  try {
    const t = await getTransporter();

    const fromAddress = getFromAddress();

    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your IntellMeet Verification Code</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px 12px; color: #1e293b;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          <tr>
            <td style="background-color: #2563eb; padding: 28px 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0 0 6px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Intelli<span style="color: #93c5fd;">Meet</span></h1>
              <span style="display: inline-block; background-color: rgba(255,255,255,0.2); color: #ffffff; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">Email Verification</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 28px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #0f172a;">Hello ${recipientName || "there"},</p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Thank you for joining <strong>IntellMeet</strong>! To verify your email address and activate your account, please enter the 6-digit verification code below:
              </p>
              
              <!-- OTP Box -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <div style="font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; color: #1d4ed8; margin-bottom: 8px;">Your Verification Code</div>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e40af; font-family: monospace;">${otp}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 10px;">Valid for <strong>10 minutes</strong>. Do not share this code with anyone.</div>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                If you did not request this verification code, please disregard this email. Your email will not be registered without this code.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px; text-align: center; font-size: 11px; color: #94a3b8;">
              © ${new Date().getFullYear()} IntellMeet. Enterprise Video Collaboration & AI Workspaces.
            </td>
          </tr>
        </table>
      </body>
    </html>
    `;

    const info = await t.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject: `🔐 Your IntellMeet Verification Code: ${otp}`,
      text: `Hello ${recipientName || "there"},\n\nYour IntellMeet verification code is: ${otp}\n\nValid for 10 minutes. Do not share this code with anyone.\n\n© ${new Date().getFullYear()} IntellMeet`,
      html,
    });

    console.log(`[Email Service] Signup OTP sent to ${recipientEmail}`);
    return info;
  } catch (err) {
    console.error(`Failed to send signup OTP email to ${recipientEmail}:`, err.message);
    throw new Error(`Failed to send verification code email: ${err.message}`);
  }
};

module.exports = {
  sendMeetingInviteEmail,
  sendWorkspaceInviteEmail,
  sendMeetingUpdatedEmail,
  sendMeetingCancelledEmail,
  sendMeetingEndedEmail,
  sendMeetingExpiredEmail,
  sendWorkspaceJoinRequestAcceptedEmail,
  sendWorkspaceRoleUpdatedEmail,
  sendWorkspaceRemovedEmail,
  sendSignupOtpEmail,
};
