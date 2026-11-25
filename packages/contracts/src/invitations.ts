export type Invitation = {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
};

export type CreateInvitationResponse = {
  invitation: Invitation;
  url: string;
};

export type SendInvitationEmailResponse = {
  emailStatus: "submitted" | "unconfirmed";
};
