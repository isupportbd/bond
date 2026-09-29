import { eq } from "drizzle-orm";
import { db, password } from "@/framework/facade.js";
import { roles } from "@/modules/auth/database/models/role.js";
import { users } from "@/modules/auth/database/models/user.js";

export const table = users;

export default async function UserSeeder() {
  // 1. Ensure required roles exist
  let adminRole = await db.query.roles?.findFirst({ where: eq(roles.name, "admin") });
  if (!adminRole) {
    const [created] = await db.insert(roles).values({ name: "admin" }).returning();
    adminRole = created;
  }

  let userRole = await db.query.roles?.findFirst({ where: eq(roles.name, "user") });
  if (!userRole) {
    const [created] = await db.insert(roles).values({ name: "user" }).returning();
    userRole = created;
  }

  // 2. Fetch Admin Credentials exclusively from .env (No hardcoded values)
  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  const adminName = (process.env.ADMIN_NAME || "Administrator").trim();

  if (!adminEmail || !adminPassword) {
    console.log("ℹ️  ADMIN_EMAIL or ADMIN_PASSWORD not configured in .env. Skipping admin user creation.");
    return;
  }

  const hashedPassword = await password.hashPassword(adminPassword);
  const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail));

  if (existingAdmin.length === 0) {
    await db.insert(users).values({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      roleId: adminRole.id,
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`✅ Admin account created successfully from .env: ${adminEmail}`);
  } else {
    await db
      .update(users)
      .set({
        name: adminName,
        password: hashedPassword,
        roleId: adminRole.id,
        emailVerifiedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.email, adminEmail));
    console.log(`✅ Admin account synced with .env credentials: ${adminEmail}`);
  }
}
