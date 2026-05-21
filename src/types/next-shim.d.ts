declare module 'next/server' {
  export { NextResponse } from '../compat/next-server.js';
}

declare module 'next/headers' {
  export function cookies(): Promise<{
    get: (name: string) => { name: string; value: string } | undefined;
    getAll: () => { name: string; value: string }[];
  }>;
}
