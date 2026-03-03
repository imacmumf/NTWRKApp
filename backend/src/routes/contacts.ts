import { Router, Response } from 'express';
import { getSession } from '../config/neo4j';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { normalizePhone } from '../utils/normalizePhone';

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
    // Normalize the current user's phone too
    const userPhone = req.phone ? normalizePhone(req.phone) : null;

    // Ensure current user exists as a node — save name, email, and phone
    await session.run(
      `MERGE (u:User {uid: $uid})
       SET u.email = $email,
           u.name = COALESCE($name, u.name),
           u.phone = COALESCE($phone, u.phone)
       RETURN u`,
      { uid, email: req.email, name: req.displayName ?? null, phone: userPhone },
    );

    // Create contact nodes and relationships with normalized phone
    for (const contact of contacts) {
      const phone = normalizePhone(contact.phone);
      if (!phone) continue; // skip contacts with no usable phone

      await session.run(
        `
        MATCH (u:User {uid: $uid})
        MERGE (c:Contact {phone: $phone})
        SET c.name = $name
        MERGE (u)-[:KNOWS]->(c)
        `,
        { uid, phone, name: contact.name },
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

// Manually add a single contact
router.post('/add', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { name, phone, email } = req.body as { name: string; phone: string; email?: string };
  const uid = req.uid!;

  if (!name || !phone) {
    res.status(400).json({ error: 'name and phone are required' });
    return;
  }

  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone.length < 7) {
    res.status(400).json({ error: 'Invalid phone number' });
    return;
  }

  const session = getSession();

  try {
    // 1. Ensure the current user node exists
    const userPhone = req.phone ? normalizePhone(req.phone) : null;
    await session.run(
      `MERGE (u:User {uid: $uid})
       SET u.email = $email,
           u.name = COALESCE($name, u.name),
           u.phone = COALESCE($phone, u.phone)
       RETURN u`,
      { uid, email: req.email, name: req.displayName ?? null, phone: userPhone },
    );

    // 2. Create or merge the Contact node with the normalized phone
    //    Store optional email on the Contact node too
    await session.run(
      `
      MATCH (u:User {uid: $uid})
      MERGE (c:Contact {phone: $phone})
      SET c.name = $name
      ${email ? ', c.email = $email' : ''}
      MERGE (u)-[:KNOWS]->(c)
      `,
      { uid, phone: normalizedPhone, name, email: email || null },
    );

    // 3. Check if this contact matches an existing User (by phone)
    //    and create the IS_USER link if so
    const linkResult = await session.run(
      `
      MATCH (c:Contact {phone: $phone})
      MATCH (target:User {phone: $phone})
      MERGE (c)-[:IS_USER]->(target)
      RETURN target.uid AS targetUid, target.name AS targetName
      `,
      { phone: normalizedPhone },
    );

    // 4. If the target person is a user AND they also have the current user
    //    in their contacts, create the reciprocal IS_USER link too
    if (linkResult.records.length > 0) {
      await session.run(
        `
        MATCH (target:User {phone: $targetPhone})-[:KNOWS]->(c:Contact {phone: $myPhone})
        MATCH (me:User {uid: $uid})
        MERGE (c)-[:IS_USER]->(me)
        `,
        { targetPhone: normalizedPhone, myPhone: userPhone, uid },
      );
    }

    const isUser = linkResult.records.length > 0;
    const targetName = isUser ? linkResult.records[0].get('targetName') : null;

    res.json({
      message: 'Contact added',
      contact: {
        name,
        phone: normalizedPhone,
        email: email || null,
        isUser,
        linkedName: targetName,
      },
    });
  } catch (error) {
    console.error('Failed to add contact:', error);
    res.status(500).json({ error: 'Failed to add contact' });
  } finally {
    await session.close();
  }
});

export default router;
