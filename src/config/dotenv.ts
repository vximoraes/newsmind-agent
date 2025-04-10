import dotenv from 'dotenv';
dotenv.config();

export const USE_CSV_FALLBACK = process.env.USE_CSV_FALLBACK === 'true';
export const {
    GOOGLE_API_KEY,
    PINECONE_API_KEY,
    PINECONE_INDEX_NAME = 'news-articles',
    KAFKA_BROKER,
    KAFKA_USERNAME,
    KAFKA_PASSWORD,
    KAFKA_TOPIC_NAME,
    KAFKA_GROUP_ID_PREFIX,
    LANGFUSE_SECRET_KEY,
    LANGFUSE_PUBLIC_KEY,
    LANGFUSE_BASEURL
} = process.env;