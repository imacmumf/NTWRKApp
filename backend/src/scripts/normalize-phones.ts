/**
 * One-time migration: normalize all phone numbers in Neo4j
 * so they match the format used by normalizePhone().
 *
 * Run with:  npx ts-node src/scripts/normalize-phones.ts
 */
import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
import { normalizePhone } from '../utils/normalizePhone';

dotenv.config();

async function main() {
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'neo4j';

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();

  try {
    // --- Normalize User phones ---
    const usersResult = await session.run(
      `MATCH (u:User) WHERE u.phone IS NOT NULL RETURN u.uid AS uid, u.phone AS phone`,
    );

    let userCount = 0;
    for (const record of usersResult.records) {
      const uid = record.get('uid') as string;
      const raw = record.get('phone') as string;
      const normalized = normalizePhone(raw);

      if (normalized !== raw) {
        await session.run(
          `MATCH (u:User {uid: $uid}) SET u.phone = $phone`,
          { uid, phone: normalized },
        );
        console.log(`  User ${uid}: "${raw}" → "${normalized}"`);
        userCount++;
      }
    }
    console.log(`Normalized ${userCount} User phone numbers.`);

    // --- Normalize Contact phones ---
    // Contacts are keyed by phone, so we need to handle merges carefully
    const contactsResult = await session.run(
      `MATCH (c:Contact) RETURN c.phone AS phone, c.name AS name`,
    );

    let contactCount = 0;
    for (const record of contactsResult.records) {
      const raw = record.get('phone') as string;
      const normalized = normalizePhone(raw);

      if (normalized !== raw) {
        // Check if a Contact with the normalized phone already exists
        const existing = await session.run(
          `MATCH (c:Contact {phone: $normalized}) RETURN c`,
          { normalized },
        );

        if (existing.records.length > 0) {
          // Merge relationships from the old contact to the existing one, then delete old
          await session.run(
            `MATCH (old:Contact {phone: $oldPhone})
             MATCH (target:Contact {phone: $newPhone})
             OPTIONAL MATCH (u)-[r:KNOWS]->(old)
             FOREACH (_ IN CASE WHEN u IS NOT NULL THEN [1] ELSE [] END |
               MERGE (u)-[:KNOWS]->(target)
             )
             OPTIONAL MATCH (old)-[r2:IS_USER]->(linked)
             FOREACH (_ IN CASE WHEN linked IS NOT NULL THEN [1] ELSE [] END |
               MERGE (target)-[:IS_USER]->(linked)
             )
             DETACH DELETE old`,
            { oldPhone: raw, newPhone: normalized },
          );
        } else {
          // Just update the phone number
          await session.run(
            `MATCH (c:Contact {phone: $oldPhone}) SET c.phone = $newPhone`,
            { oldPhone: raw, newPhone: normalized },
          );
        }
        console.log(`  Contact: "${raw}" → "${normalized}"`);
        contactCount++;
      }
    }
    console.log(`Normalized ${contactCount} Contact phone numbers.`);

    // --- Re-link contacts to users by matching normalized phones ---
    await session.run(
      `MATCH (c:Contact), (u:User)
       WHERE c.phone = u.phone
       MERGE (c)-[:IS_USER]->(u)`,
    );
    console.log('Re-linked contacts to users by phone.');

    console.log('\n✅ Phone normalization complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
