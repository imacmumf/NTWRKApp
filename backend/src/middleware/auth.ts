import { Request, Response, NextFunction } from 'express';
import { getAuth, clerkClient } from '@clerk/express';

export interface AuthenticatedRequest extends Request {
  uid?: string;
  email?: string;
  phone?: string;
  displayName?: string;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const auth = getAuth(req);

    if (!auth?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await clerkClient.users.getUser(auth.userId);

    req.uid = auth.userId;
    req.email = user.emailAddresses[0]?.emailAddress;
    req.phone = user.phoneNumbers[0]?.phoneNumber ?? undefined;
    req.displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
