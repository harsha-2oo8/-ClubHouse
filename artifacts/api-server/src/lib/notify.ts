import { db, notificationsTable } from "@workspace/db";

export type NotificationType =
  | "project_application_submitted"
  | "application_approved"
  | "application_rejected"
  | "project_invite"
  | "college_join_request"
  | "college_join_approved"
  | "college_join_rejected"
  | "moderator_application"
  | "moderator_approved"
  | "meeting_scheduled"
  | "event_registration"
  | "college_approved"
  | "college_rejected"
  | "club_event";

async function send(
  clerkId: string,
  type: string,
  message: string,
  linkUrl: string | null = null,
): Promise<void> {
  await db.insert(notificationsTable).values({
    clerkId,
    type,
    message,
    linkUrl,
    read: false,
  });
}

export const notificationService = {
  send,
  applicationSubmitted: (ownerId: string, projectTitle: string, projectId: number) =>
    send(ownerId, "project_application_submitted", `New application for "${projectTitle}"`, `/projects/${projectId}`),
  applicationApproved: (clerkId: string, projectTitle: string, projectId: number) =>
    send(clerkId, "application_approved", `Your application for "${projectTitle}" was approved!`, `/projects/${projectId}`),
  applicationRejected: (clerkId: string, projectTitle: string, projectId: number) =>
    send(clerkId, "application_rejected", `Your application for "${projectTitle}" was not approved.`, `/projects/${projectId}`),
  projectInvite: (clerkId: string, projectTitle: string, projectId: number) =>
    send(clerkId, "project_invite", `You were invited to "${projectTitle}"`, `/projects/${projectId}`),
  joinRequest: (moderatorId: string, collegeName: string, collegeId: number) =>
    send(moderatorId, "college_join_request", `New join request for "${collegeName}"`, `/colleges/${collegeId}`),
  joinRequestApproved: (clerkId: string, collegeName: string, collegeId: number) =>
    send(clerkId, "college_join_approved", `Your request to join "${collegeName}" was approved!`, `/colleges/${collegeId}`),
  joinRequestRejected: (clerkId: string, collegeName: string, collegeId: number) =>
    send(clerkId, "college_join_rejected", `Your request to join "${collegeName}" was not approved.`, `/colleges/${collegeId}`),
  meetingScheduled: (clerkId: string, title: string, linkUrl: string) =>
    send(clerkId, "meeting_scheduled", `New meeting: "${title}"`, linkUrl),
  eventRegistration: (clerkId: string, eventTitle: string, eventId: number) =>
    send(clerkId, "event_registration", `You registered for "${eventTitle}"`, `/discover/events`),
};
