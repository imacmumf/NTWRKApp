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

// Get current user's profile
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.uid!;
  const session = getSession();

  try {
    const result = await session.run(
      `MATCH (u:User {uid: $uid})
       RETURN u.name AS name, u.email AS email, u.phone AS phone,
              u.location AS location, u.college AS college,
              u.highSchool AS highSchool, u.company AS company,
              u.jobTitle AS jobTitle, u.industry AS industry,
              u.hometown AS hometown, u.bio AS bio`,
      { uid },
    );

    if (result.records.length === 0) {
      res.json({
        name: req.displayName ?? null,
        email: req.email,
        phone: req.phone ?? null,
        location: null,
        college: null,
        highSchool: null,
        company: null,
        jobTitle: null,
        industry: null,
        hometown: null,
        bio: null,
      });
      return;
    }

    const r = result.records[0];
    res.json({
      name: r.get('name') ?? req.displayName ?? null,
      email: r.get('email') ?? req.email,
      phone: r.get('phone') ?? req.phone ?? null,
      location: r.get('location') ?? null,
      college: r.get('college') ?? null,
      highSchool: r.get('highSchool') ?? null,
      company: r.get('company') ?? null,
      jobTitle: r.get('jobTitle') ?? null,
      industry: r.get('industry') ?? null,
      hometown: r.get('hometown') ?? null,
      bio: r.get('bio') ?? null,
    });
  } catch (error) {
    console.error('Failed to get profile:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  } finally {
    await session.close();
  }
});

// Update current user's profile
router.put('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.uid!;
  const {
    name, phone, location, college, highSchool,
    company, jobTitle, industry, hometown, bio,
  } = req.body as Record<string, string | undefined>;
  const session = getSession();

  try {
    await session.run(
      `MERGE (u:User {uid: $uid})
       SET u.email = $email,
           u.name = COALESCE($name, u.name),
           u.phone = COALESCE($phone, u.phone),
           u.location = COALESCE($location, u.location),
           u.college = COALESCE($college, u.college),
           u.highSchool = COALESCE($highSchool, u.highSchool),
           u.company = COALESCE($company, u.company),
           u.jobTitle = COALESCE($jobTitle, u.jobTitle),
           u.industry = COALESCE($industry, u.industry),
           u.hometown = COALESCE($hometown, u.hometown),
           u.bio = COALESCE($bio, u.bio)
       RETURN u`,
      {
        uid, email: req.email,
        name: name ?? null, phone: phone ?? null,
        location: location ?? null, college: college ?? null,
        highSchool: highSchool ?? null, company: company ?? null,
        jobTitle: jobTitle ?? null, industry: industry ?? null,
        hometown: hometown ?? null, bio: bio ?? null,
      },
    );

    // Re-link any contacts that match this phone number
    if (phone) {
      await session.run(
        `MATCH (c:Contact {phone: $phone})
         MATCH (u:User {uid: $uid})
         MERGE (c)-[:IS_USER]->(u)`,
        { phone, uid },
      );
    }

    res.json({ message: 'Profile updated' });
  } catch (error) {
    console.error('Failed to update profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  } finally {
    await session.close();
  }
});

export default router;
