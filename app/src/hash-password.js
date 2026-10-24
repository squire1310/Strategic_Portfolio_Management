import { hashPassword } from './auth.js';

let password = '';
for await (const chunk of process.stdin) password += chunk;
password = password.replace(/\r?\n$/, '');
console.log(hashPassword(password));

