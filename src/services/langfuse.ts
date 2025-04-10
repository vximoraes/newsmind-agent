import { Langfuse } from 'langfuse';
import dotenv from 'dotenv';

dotenv.config();

export const langfuse = new Langfuse({
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    baseUrl: process.env.LANGFUSE_BASEURL
});  