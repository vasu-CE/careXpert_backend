const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash("admin", 10);

    const admin = await prisma.$transaction(async (prisma) => {
      // Create the user
      const user = await prisma.user.create({
        data: {
          name: "admin",
          email: "admin@carexpert.com",
          password: hashedPassword,
          role: "ADMIN",
          profilePicture:
            "https://res.cloudinary.com/de930by1y/image/upload/v1747403920/careXpert_profile_pictures/kxwsom57lcjamzpfjdod.jpg",
        },
      });

      // Create the admin record
      const adminRecord = await prisma.admin.create({
        data: {
          userId: user.id,
          permissions: {
            canManageUsers: true,
            canManageDoctors: true,
            canManagePatients: true,
            canViewAnalytics: true,
            canManageSystem: true,
          },
        },
      });

      return { user, admin: adminRecord };
    });

    console.log("Admin created successfully:", admin);
  } catch (error) {
    console.error("Error creating admin:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
