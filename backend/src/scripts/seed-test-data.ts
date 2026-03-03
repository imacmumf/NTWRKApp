/**
 * Seed test data into Neo4j to demonstrate network path-finding.
 *
 * Creates this chain:
 *   Your Account (real Clerk user)
 *     └── KNOWS → Kate Miller (direct — she's in your contacts)
 *                   └── KNOWS → Jane Thompson (2nd degree)
 *                                 └── KNOWS → Sarah Chen (3rd degree)
 *                                               └── KNOWS → David Park (4th degree)
 *
 * Plus cross-connections so mutual-connection queries return results.
 *
 * When you tap Sarah in the app, it will show:
 *   "Connected through 2 people"
 *   You → Kate Miller → Jane Thompson → Sarah Chen
 *
 * The direct "You KNOWS Sarah" relationship is excluded from path display
 * because that's obvious — you just added her. The value is showing the
 * INDIRECT network path.
 *
 * Run with:  npx ts-node src/scripts/seed-test-data.ts
 */
import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

// Test users with their normalized phone numbers
const TEST_USERS = [
  { uid: 'test-kate',   name: 'Kate Miller',     email: 'kate@test.ntwrk',   phone: '15551001001' },
  { uid: 'test-jane',   name: 'Jane Thompson',   email: 'jane@test.ntwrk',   phone: '15551002002' },
  { uid: 'test-sarah',  name: 'Sarah Chen',       email: 'sarah@test.ntwrk',  phone: '15551003003' },
  { uid: 'test-david',  name: 'David Park',       email: 'david@test.ntwrk',  phone: '15551004004' },
  { uid: 'test-alex',   name: 'Alex Rivera',      email: 'alex@test.ntwrk',   phone: '15551005005' },
  { uid: 'test-maria',  name: 'Maria Garcia',     email: 'maria@test.ntwrk',  phone: '15551006006' },
];

// Who KNOWS whom (by uid): source → [targets]
// Each entry creates: User(source) -[:KNOWS]-> Contact(target.phone) -[:IS_USER]-> User(target)
const CONNECTIONS: Record<string, string[]> = {
  // Kate knows Jane and Alex
  'test-kate':  ['test-jane', 'test-alex'],
  // Jane knows Sarah and Maria and Kate
  'test-jane':  ['test-sarah', 'test-maria', 'test-kate'],
  // Sarah knows David and Jane
  'test-sarah': ['test-david', 'test-jane'],
  // David knows Sarah
  'test-david': ['test-sarah'],
  // Alex knows Kate and Maria
  'test-alex':  ['test-kate', 'test-maria'],
  // Maria knows Jane and Alex
  'test-maria': ['test-jane', 'test-alex'],
};

async function main() {
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'neo4j';

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();

  try {
    console.log('🌱 Seeding test data...\n');

    // 1. Create all test User nodes
    for (const u of TEST_USERS) {
      await session.run(
        `MERGE (u:User {uid: $uid})
         SET u.name = $name, u.email = $email, u.phone = $phone
         RETURN u`,
        u,
      );
      console.log(`  Created user: ${u.name} (${u.phone})`);
    }

    // 2. Create KNOWS relationships (User → Contact → IS_USER → User)
    const userMap = new Map(TEST_USERS.map((u) => [u.uid, u]));

    for (const [sourceUid, targetUids] of Object.entries(CONNECTIONS)) {
      for (const targetUid of targetUids) {
        const target = userMap.get(targetUid)!;

        // Create/merge the Contact node for the target
        await session.run(
          `MATCH (u:User {uid: $sourceUid})
           MERGE (c:Contact {phone: $phone})
           SET c.name = $name
           MERGE (u)-[:KNOWS]->(c)`,
          { sourceUid, phone: target.phone, name: target.name },
        );

        // Link the Contact to the target User
        await session.run(
          `MATCH (c:Contact {phone: $phone})
           MATCH (target:User {uid: $targetUid})
           MERGE (c)-[:IS_USER]->(target)`,
          { phone: target.phone, targetUid },
        );
      }
    }
    console.log('\n  Created all KNOWS relationships.');

    // 3. Now connect YOUR real account to Kate (so you have a path to everyone)
    //    Find the real user (non-test UID)
    const realUserResult = await session.run(
      `MATCH (u:User)
       WHERE NOT u.uid STARTS WITH 'test-'
       RETURN u.uid AS uid, u.name AS name
       LIMIT 1`,
    );

    if (realUserResult.records.length > 0) {
      const realUid = realUserResult.records[0].get('uid') as string;
      const realName = realUserResult.records[0].get('name') as string;

      // You KNOW Kate (your one direct contact into the test network)
      const kate = userMap.get('test-kate')!;
      await session.run(
        `MATCH (u:User {uid: $uid})
         MERGE (c:Contact {phone: $phone})
         SET c.name = $name
         MERGE (u)-[:KNOWS]->(c)`,
        { uid: realUid, phone: kate.phone, name: kate.name },
      );
      await session.run(
        `MATCH (c:Contact {phone: $phone})
         MATCH (target:User {uid: $targetUid})
         MERGE (c)-[:IS_USER]->(target)`,
        { phone: kate.phone, targetUid: kate.uid },
      );

      // Also add Sarah and Alex to your contacts — they'll show up in
      // your contacts list, and when you view them the app will find the
      // INDIRECT network path (skipping the direct KNOWS edge).
      for (const testUid of ['test-sarah', 'test-alex']) {
        const person = userMap.get(testUid)!;
        await session.run(
          `MATCH (u:User {uid: $uid})
           MERGE (c:Contact {phone: $phone})
           SET c.name = $name
           MERGE (u)-[:KNOWS]->(c)`,
          { uid: realUid, phone: person.phone, name: person.name },
        );
        await session.run(
          `MATCH (c:Contact {phone: $phone})
           MATCH (target:User {uid: $targetUid})
           MERGE (c)-[:IS_USER]->(target)`,
          { phone: person.phone, targetUid: person.uid },
        );
      }

      console.log(`\n  Linked your account (${realName}) to Kate, Sarah, and Alex.`);
      console.log(`\n  Network paths (visible in-app):`);
      console.log(`    Sarah Chen:  You → Kate Miller → Jane Thompson → Sarah Chen`);
      console.log(`    Alex Rivera: You → Kate Miller → Alex Rivera`);
      console.log(`    David Park:  You → Kate Miller → Jane Thompson → Sarah Chen → David Park`);
    } else {
      console.log('\n  ⚠️  No real user found. Sign in to the app first, then re-run this script.');
    }

    console.log('\n✅ Test data seeded successfully!');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
