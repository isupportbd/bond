import { eq } from "drizzle-orm";
import { db, password } from "@/framework/facade.js";
import { roles } from "@/modules/auth/database/models/role.js";
import { users } from "@/modules/auth/database/models/user.js";

/**
 * Automatically ensures default roles and the initial Administrator account
 * exist on server startup, populated directly from .env configuration.
 */
export async function ensureAdminOnStartup() {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
    const adminName = (process.env.ADMIN_NAME || "Administrator").trim();

    if (!adminEmail || !adminPassword) {
      return;
    }

    // 1. Ensure required roles exist in the database
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

    // 2. Check if the administrator already exists
    const existingAdmin = await db.query.users?.findFirst({
      where: eq(users.email, adminEmail)
    });

    const hashedPassword = await password.hashPassword(adminPassword);

    if (!existingAdmin) {
      await db.insert(users).values({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        roleId: adminRole.id,
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`🛡️  [Bootstrap] Admin account automatically initialized from .env: ${adminEmail}`);
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
        .where(eq(users.id, existingAdmin.id));
      console.log(`🛡️  [Bootstrap] Admin account verified & synchronized with .env: ${adminEmail}`);
    }
  } catch (err: any) {
    // Gracefully handle if tables are not yet created or DB is initializing
    console.warn("⚠️  [Bootstrap] Notice: Auto-admin sync skipped (database may still be initializing):", err?.message || err);
  }
}
