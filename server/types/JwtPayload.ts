export interface JwtPayloadClient {
  userId: string;
  username: string;
  discriminator: string | null;
  avatar: string | null;
  isAdmin: boolean;
  rolePermissions?: string[];
  iat: number;
  exp: number;
}

export interface JwtPayload extends JwtPayloadClient {
  id: string;
}
