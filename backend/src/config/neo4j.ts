import neo4j, { Driver, Session } from 'neo4j-driver';

let driver: Driver;

export function initNeo4j(): void {
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'neo4j';

  driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  console.log(`Connected to Neo4j at ${uri}`);
}

export function getSession(): Session {
  if (!driver) {
    throw new Error('Neo4j driver not initialized. Call initNeo4j() first.');
  }
  return driver.session();
}

export async function closeNeo4j(): Promise<void> {
  if (driver) {
    await driver.close();
  }
}
