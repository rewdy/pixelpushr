export type Identity = { subject: string; email: string };
export type SignUpResult = { subject: string; confirmationRequired: boolean };
export type Session = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
};

export type AuthProvider = {
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  confirm: (email: string, code: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<Session>;
  verify: (
    token: string,
    options?: { requireVerifiedEmail?: boolean },
  ) => Promise<Identity>;
};
