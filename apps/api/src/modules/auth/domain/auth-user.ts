/** Basic account data returned by authenticated endpoints such as /auth/me. */
export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};
