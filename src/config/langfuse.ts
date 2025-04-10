import { Langfuse } from 'langfuse';
import {
    LANGFUSE_SECRET_KEY,
    LANGFUSE_PUBLIC_KEY,
    LANGFUSE_BASEURL
} from './dotenv';

export const langfuse = new Langfuse({
    secretKey: LANGFUSE_SECRET_KEY!,
    publicKey: LANGFUSE_PUBLIC_KEY!,
    baseUrl: LANGFUSE_BASEURL
});