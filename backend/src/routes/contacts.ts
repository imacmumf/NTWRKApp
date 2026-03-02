import { Router, Response } from 'express';
import { getSession } from '../config/neo4j';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// Sync contacts to Neo4j
router.post('/sync', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { contacts } = req.body as { contacts: { name: string; phone: string }[] };
  const uid = req.uid!;

  if (!contacts || !Array.isArray(contacts)) {
    res.status(400).json({ error: 'contacts must be an array of { name, phone }' });
    return;
  }

  const session = getSession();

  try {
    // Ensure current user exists as a node — save name, email, and phone
    await session.run(
      `MERGE (u:User {uid: $uid})
       SET u.email = $email,
           u.name = COALESCE($name, u.name),
           u.phone = COALESCE($phone, u.phone)
       RETURN u`,
      { uid, email: req.email, name: req.displayName ?? null, phone: req.phone ?? null },
    );

    // Create contact nodes and relationships
    for (const contact of contacts) {
      await session.run(
        `
        MATCH (u:User {uid: $uid})
        MERGE (c:Contact {phone: $phone})
        SET c.name = $name
        MERGE (u)-[:KNOWS]->(c)
        `,
        { uid, phone: contact.phone, name: contact.name },
      );
    }

    // Link contacts to existing users by matching phone numbers
    await session.run(
      `
      MATCH (c:Contact)
      WHERE EXISTS { MATCH (u:User) WHERE u.phone = c.phone }
      MATCH (u:User {phone: c.phone})
      MERGE (c)-[:IS_USER]->(u)
      `,
    );

    res.json({ message: `Synced ${contacts.length} contacts`, count: contacts.length });
  } catch (error) {
    console.error('Failed to sync contacts:', error);
    res.status(500).json({ error: 'Failed to sync contacts' });
  } finally {
    await session.close();
  }
});

export default router;
