import { SharedArray } from 'k6/data';

interface DemoUser {
  username: string;
  password: string;
  role: string;
  locked: boolean;
}

/**
 * The site's demo accounts (locked ones are left out). A SharedArray is loaded once and shared by all
 * virtual users, instead of every VU keeping its own copy in memory.
 */
export const users = new SharedArray('users', () =>
  (JSON.parse(open('../../../assets/data/login-users.json')) as DemoUser[]).filter((u) => !u.locked),
);
