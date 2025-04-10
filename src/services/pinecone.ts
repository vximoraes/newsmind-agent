import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
});
const PINECONE_INDEX_NAME = 'news-articles';

export let vectorStore: any = null;

export async function initVectorDB() {
    try {
        console.log("Initializing Pinecone vector database...");
        const indexes = await pinecone.listIndexes();
        const indexNames = Array.isArray(indexes)
            ? indexes.map((index: any) => index.name)
            : [];

        if (!indexNames.includes(PINECONE_INDEX_NAME)) {
            console.log("Creating new Pinecone index...");
            try {
                await pinecone.createIndex({
                    name: PINECONE_INDEX_NAME,
                    dimension: 768,
                    metric: 'cosine',
                    spec: {
                        serverless: {
                            cloud: 'aws',
                            region: 'us-east-1'
                        }
                    }
                }); 
                await new Promise(resolve => setTimeout(resolve, 60000));
            } catch (error: any) {
                if (error.name === 'PineconeConflictError') {
                    console.warn("Index already exists, continuing...");
                } else {
                    throw error;
                }
            }
        } else {
            console.log(`Index "${PINECONE_INDEX_NAME}" already exists.`);
        }
        const index = pinecone.index(PINECONE_INDEX_NAME);
        vectorStore = index;  
        return index;
    } catch (error) {
        console.error("Error with Pinecone:", error);
        throw error;
    }
}  