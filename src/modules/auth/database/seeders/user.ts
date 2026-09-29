import { eq } from "drizzle-orm";
import { db, password } from "@/framework/facade.js";
import { roles } from "@/modules/auth/database/models/role.js";
import { users } from "@/modules/auth/database/models/user.js";

export const table = users;

export default async function UserSeeder() {
  // 1. Ensure roles exist
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

  // 2. Target Admin User
  const adminEmail = "isupportbd.info@gmail.com";
  const hashedPassword = await password.hashPassword("Expw.17@");

  const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail));

  if (existingAdmin.length === 0) {
    await db.insert(users).values({
      name: "Super Admin",
      email: adminEmail,
      password: hashedPassword,
      roleId: adminRole.id,
      emailVerifiedAt: new Date()
    });
    console.log(`Admin user created: ${adminEmail}`);
  } else {
    await db
      .update(users)
      .set({
        password: hashedPassword,
        roleId: adminRole.id,
        emailVerifiedAt: new Date()
      })
      .where(eq(users.email, adminEmail));
    console.log(`Admin user password updated: ${adminEmail}`);
  }
}
