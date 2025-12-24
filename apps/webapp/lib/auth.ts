import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectMongoose } from "./mongo";
import { UserModel } from "@/models";
import { verifyPassword } from "./password";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        await connectMongoose();

        const user = await UserModel.findOne({ email }).select({ id: 1, email: 1, name: 1, passwordHash: 1 }).lean();
        if (!user?.passwordHash) return null;
        if (!verifyPassword(user.passwordHash, password)) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
};


