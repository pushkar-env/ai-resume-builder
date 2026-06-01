import dotenv from 'dotenv';
dotenv.config();
import { db, resumesTable } from '@workspace/db';

async function run() {
  try {
    const resumes = await db.select().from(resumesTable).limit(5);
    console.log("Resumes:", resumes);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
run();
