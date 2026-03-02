import { Router, Response } from 'express';
import { getSession } from '../config/neo4j';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// Search users by name or email
router.get('/search', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.uid!;
  const query = req.query.q as string;

  if (!query || query.trim().length < 2) {
    res.status(400).json({ error: 'Search query must be at least 2 characters' });
    return;
  }

  const session = getSession();

  try {
    const result = await session.run(
      `
      MATCH (u:User)
      WHERE u.uid <> $uid
        AND (toLower(u.name) CONTAINS toLower($query)
             OR toLower(u.email) CONTAINS toLower($query))
      OPTIONAL MATCH path = shortestPath((me:User {uid: $uid})-[:KNOWS|IS_USER*]-(u))
      RETURN u.uid AS id,
             COALESCE(u.name, u.email) AS displayName,
             CASE WHEN path IS NOT NULL THEN length(path) ELSE NULL END AS degree
      LIMIT 20
      `,
      { uid, query: query.trim() },
    );

    const users = result.records.map((record) => ({
      id: record.get('id') as string,
      displayName: record.get('displayName') as string,
      degree: record.get('degree') !== null
        ? (record.get('degree') as { toNumber?: () => number }).toNumber?.() ?? record.get('degree')
        : null,
    }));

    res.json(users);
  } catch (error) {
    console.error('Failed to search users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  } finally {
    await session.close();
  }
});

export default router;
