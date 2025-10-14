export interface JwtPayload {
  id: string;
  userId: string;
  username: string;
  discriminator: string | null;
  avatar: string | null;
  isAdmin: boolean;
  iat: number;
  exp: number;
}