import { Router, Response } from 'express';
import { getSession } from '../config/neo4j';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// Get the current user's network (their contacts and 2nd-degree connections)
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.uid!;
  const session = getSession();

  try {
    // Get direct contacts (1st degree)
    const contactsResult = await session.run(
      `
      MATCH (u:User {uid: $uid})-[:KNOWS]->(c:Contact)
      OPTIONAL MATCH (c)-[:IS_USER]->(linked:User)
      RETURN c.name AS name, c.phone AS phone,
             linked.uid AS linkedUid, linked.email AS linkedEmail,
             CASE WHEN linked IS NOT NULL THEN true ELSE false END AS isUser
      ORDER BY c.name
      `,
      { uid },
    );

    const contacts = contactsResult.records.map((record) => ({
      name: record.get('name') as string,
      phone: record.get('phone') as string,
      isUser: record.get('isUser') as boolean,
      linkedUid: record.get('linkedUid') as string | null,
      linkedEmail: record.get('linkedEmail') as string | null,
    }));

    // Get 2nd-degree connections (friends of friends who are users)
    const mutualResult = await session.run(
      `
      MATCH (u:User {uid: $uid})-[:KNOWS]->(c:Contact)-[:IS_USER]->(friend:User)-[:KNOWS]->(c2:Contact)
      WHERE NOT (u)-[:KNOWS]->(c2)
        AND c2.phone <> u.phone
      OPTIONAL MATCH (c2)-[:IS_USER]->(friendOfFriend:User)
      WITH DISTINCT c2, friend, friendOfFriend
      RETURN c2.name AS name, c2.phone AS phone,
             friend.name AS throughName, friend.uid AS throughUid,
             CASE WHEN friendOfFriend IS NOT NULL THEN true ELSE false END AS isUser
      LIMIT 50
      `,
      { uid },
    );

    const suggestions = mutualResult.records.map((record) => ({
      name: record.get('name') as string,
      phone: record.get('phone') as string,
      throughName: record.get('throughName') as string,
      throughUid: record.get('throughUid') as string,
      isUser: record.get('isUser') as boolean,
    }));

    // Get stats
    const statsResult = await session.run(
      `
      MATCH (u:User {uid: $uid})-[:KNOWS]->(c:Contact)
      WITH u, count(c) AS totalContacts
      OPTIONAL MATCH (u)-[:KNOWS]->(c2:Contact)-[:IS_USER]->(linked:User)
      RETURN totalContacts, count(DISTINCT linked) AS usersInNetwork
      `,
      { uid },
    );

    const statsRecord = statsResult.records[0];
    const totalContacts = statsRecord
      ? (statsRecord.get('totalContacts') as { toNumber?: () => number })
      : 0;
    const usersInNetwork = statsRecord
      ? (statsRecord.get('usersInNetwork') as { toNumber?: () => number })
      : 0;

    res.json({
      contacts,
      suggestions,
      stats: {
        totalContacts: typeof totalContacts === 'object' && totalContacts?.toNumber
          ? totalContacts.toNumber()
          : totalContacts,
        usersInNetwork: typeof usersInNetwork === 'object' && usersInNetwork?.toNumber
          ? usersInNetwork.toNumber()
          : usersInNetwork,
      },
    });
  } catch (error) {
    console.error('Failed to get network:', error);
    res.status(500).json({ error: 'Failed to get network' });
  } finally {
    await session.close();
  }
});

// Find shortest connection path between current user and target user
router.get('/connection/:targetUid', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.uid!;
  const { targetUid } = req.params;

  const session = getSession();

  try {
    const result = await session.run(
      `
      MATCH (start:User {uid: $uid}), (end:User {uid: $targetUid}),
            path = shortestPath((start)-[:KNOWS|IS_USER*]-(end))
      RETURN [node IN nodes(path) | COALESCE(node.name, node.email, node.uid)] AS names,
             length(path) AS degree
      `,
      { uid, targetUid },
    );

    if (result.records.length === 0) {
      res.status(404).json({ error: 'No connection found' });
      return;
    }

    const record = result.records[0];
    const path = record.get('names') as string[];
    const degree = (record.get('degree') as { toNumber?: () => number });

    res.json({
      path,
      degree: typeof degree.toNumber === 'function' ? degree.toNumber() : degree,
    });
  } catch (error) {
    console.error('Failed to find connection:', error);
    res.status(500).json({ error: 'Failed to find connection' });
  } finally {
    await session.close();
  }
});

export default router;
