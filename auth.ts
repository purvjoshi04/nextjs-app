import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import { neon } from '@neondatabase/serverless';
import type { User } from '@/app/lib/definitions';
import bcrypt from 'bcrypt';

const sql = neon(process.env.DATABASE_URL || '');

async function getUser(email: string): Promise<User | undefined> {
    try {
        const result = await sql`SELECT * FROM users WHERE email=${email}`;

        if (result.length > 0) {
            const { id, name, email: userEmail, password } = result[0];

            const user: User = {
                id,
                name,
                email: userEmail,
                password
            };

            return user;
        }

        return undefined;
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}

export const { auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                // Validate credentials using zod schema
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;

                    // Get user from database
                    const user = await getUser(email);
                    if (!user) return null;

                    // Verify password
                    const passwordMatch = await bcrypt.compare(password, user.password);
                    if (passwordMatch) return user;
                }

                console.log('Invalid credentials');
                return null;
            },
        }),
    ],
});
