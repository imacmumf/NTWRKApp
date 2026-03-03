import { Router, Response } from 'express';
import { getSession } from '../config/neo4j';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { normalizePhone } from '../utils/normalizePhone';

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

// Get mutual connections between current user and a contact
router.get('/mutual/:contactPhone', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.uid!;
  const contactPhone = normalizePhone(req.params.contactPhone);

  const session = getSession();

  try {
    // Find mutual contacts between the user and the specified contact
    const result = await session.run(
      `
      MATCH (me:User {uid: $uid})-[:KNOWS]->(myContact:Contact)
      MATCH (targetContact:Contact {phone: $contactPhone})-[:IS_USER]->(targetUser:User)-[:KNOWS]->(theirContact:Contact)
      WHERE myContact.phone = theirContact.phone
        AND myContact.phone <> $contactPhone
        AND myContact.phone <> me.phone
      OPTIONAL MATCH (myContact)-[:IS_USER]->(mutualUser:User)
      RETURN DISTINCT myContact.name AS name, 
             myContact.phone AS phone,
             CASE WHEN mutualUser IS NOT NULL THEN true ELSE false END AS isUser,
             mutualUser.uid AS linkedUid
      ORDER BY myContact.name
      `,
      { uid, contactPhone },
    );

    const mutualConnections = result.records.map((record) => ({
      name: record.get('name') as string,
      phone: record.get('phone') as string,
      isUser: record.get('isUser') as boolean,
      linkedUid: record.get('linkedUid') as string | null,
    }));

    // Get the target contact info
    const targetResult = await session.run(
      `MATCH (c:Contact {phone: $contactPhone})
       OPTIONAL MATCH (c)-[:IS_USER]->(u:User)
       RETURN c.name AS name, c.phone AS phone,
              CASE WHEN u IS NOT NULL THEN true ELSE false END AS isUser,
              u.uid AS linkedUid`,
      { contactPhone },
    );

    let targetContact = null;
    if (targetResult.records.length > 0) {
      const record = targetResult.records[0];
      targetContact = {
        name: record.get('name') as string,
        phone: record.get('phone') as string,
        isUser: record.get('isUser') as boolean,
        linkedUid: record.get('linkedUid') as string | null,
      };
    }

    // Find shortest INDIRECT connection path — i.e. how do you know this
    // person through your network, EXCLUDING the direct KNOWS relationship.
    // This is the core value of the app: "you just added Sarah — but did
    // you know she's connected to you through Kate → Jane?"
    let connectionPath: string[] | null = null;
    let connectionDegree: number | null = null;

    if (targetContact?.linkedUid) {
      // First, find the direct Contact node that connects the current user to the target
      // so we can exclude it from the indirect path search.
      const directContactResult = await session.run(
        `MATCH (me:User {uid: $uid})-[:KNOWS]->(dc:Contact {phone: $contactPhone})
         RETURN elementId(dc) AS directContactId`,
        { uid, contactPhone },
      );

      const directContactId = directContactResult.records.length > 0
        ? directContactResult.records[0].get('directContactId')
        : null;

      // Find shortest path that does NOT go through the direct Contact node.
      // This gives us the "how you're already connected through the network" path.
      const pathResult = await session.run(
        `
        MATCH (start:User {uid: $uid}), (end:User {uid: $targetUid})
        MATCH path = shortestPath((start)-[:KNOWS|IS_USER*]-(end))
        WHERE $directContactId IS NULL
           OR ALL(n IN nodes(path) WHERE elementId(n) <> $directContactId)
        RETURN [node IN nodes(path) | COALESCE(node.name, node.email, node.uid)] AS names,
               [node IN nodes(path) | labels(node)[0]] AS nodeLabels,
               length(path) AS degree
        `,
        { uid, targetUid: targetContact.linkedUid, directContactId },
      );

      if (pathResult.records.length > 0) {
        const pathRecord = pathResult.records[0];
        const rawNames = pathRecord.get('names') as string[];
        const nodeLabels = pathRecord.get('nodeLabels') as string[];
        const rawDegree = pathRecord.get('degree') as any;
        const rawDegreeNum = typeof rawDegree.toNumber === 'function'
          ? rawDegree.toNumber()
          : rawDegree;

        // Build a clean people-only path by deduplicating consecutive
        // Contact→IS_USER→User pairs where the same person appears twice.
        // The raw path alternates User and Contact nodes:
        //   User(You) → Contact(Kate) → User(Kate) → Contact(Jane) → User(Jane) ...
        // We want:  You → Kate → Jane → ...
        // BUT sometimes the path takes shortcuts (bidirectional traversal), e.g.:
        //   User(You) → Contact(Kate) → User(Jane) → Contact(Jane) → User(Sarah)
        // So we can't just blindly skip Contact nodes — we deduplicate by name.
        const peoplePath: string[] = [];
        for (let i = 0; i < rawNames.length; i++) {
          const name = rawNames[i];
          // Skip if this name is the same as the previous (Contact/User dupe)
          if (peoplePath.length > 0 && peoplePath[peoplePath.length - 1] === name) continue;
          peoplePath.push(name);
        }

        // Only show paths with 2+ degrees (i.e. at least one intermediary person)
        const degree = peoplePath.length - 1; // number of hops between people
        if (degree >= 2) {
          connectionPath = peoplePath;
          connectionDegree = degree;
        }
      }
    }

    res.json({
      targetContact,
      mutualConnections,
      count: mutualConnections.length,
      connectionPath,
      connectionDegree,
    });
  } catch (error) {
    console.error('Failed to get mutual connections:', error);
    res.status(500).json({ error: 'Failed to get mutual connections' });
  } finally {
    await session.close();
  }
});

export default router;
