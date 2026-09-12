import { auth } from '@/lib/auth/server';

export default auth.middleware({ loginUrl: '/auth/sign-in' });

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|school-logo.png|guidance-logo.png).*)"],
};
