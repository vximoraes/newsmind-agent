import { createServer } from 'http'  
import { createYoga } from 'graphql-yoga'  
import { makeExecutableSchema } from '@graphql-tools/schema'  
import dotenv from 'dotenv'  
import { GoogleGenerativeAI } from '@google/generative-ai'  
import { readFileSync } from 'fs'  
import { parse } from 'csv-parse/sync'  
import path from 'path'  
import { Kafka } from 'kafkajs'  
import { Pinecone } from '@pinecone-database/pinecone'  

dotenv.config()  

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)  
const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })  
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" })  

const pinecone = new Pinecone({  
    apiKey: process.env.PINECONE_API_KEY!,  
})  
const PINECONE_INDEX_NAME = 'news-articles'  

interface Article {  
    title: string;  
    content: string;  
    url: string;  
    date: string;  
}  

interface Source {  
    title: string;  
    url: string;  
    date: string;  
}  

const typeDefs = `  
type Source {  
    title: String!  
    url: String!  
    date: String!  
}  

type AgentResponse {  
    answer: String!  
    sources: [Source!]!  
}  

type Query {  
    _empty: String  
}  

type Mutation {  
    askAgent(query: String!): AgentResponse!  
}  

type Subscription {  
    agentStream(query: String!): AgentResponse!  
}  
`  

async function getEmbeddings(text: string): Promise<number[]> {  
    const result = await embeddingModel.embedContent(text);  
    const embedding = result.embedding;  
    return embedding.values;  
}  

function createSimpleVectorStore() {  
    let vectors: Array<{ id: string, values: number[], metadata: any }> = [];  

    return {  
        upsert: async (newVectors: Array<{ id: string, values: number[], metadata: any }>) => {  
            vectors = [...vectors, ...newVectors];  
            return { upsertedCount: newVectors.length };  
        },  

        query: async ({ vector, topK, filter }: { vector: number[], topK: number, filter?: any }) => {  
            const cosineSimilarity = (a: number[], b: number[]) => {  
                let dotProduct = 0;  
                let normA = 0;  
                let normB = 0;  
                for (let i = 0; i < a.length; i++) {  
                    dotProduct += a[i] * b[i];  
                    normA += a[i] * a[i];  
                    normB += b[i] * b[i];  
                }  
                return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));  
            };  

            let filteredVectors = vectors;  
            if (filter) {  
                filteredVectors = vectors.filter(v => {  
                    if (filter.url && filter.url.$eq) {  
                        return v.metadata.url === filter.url.$eq;  
                    }  
                    return true;  
                });  
            }  

            const similarities = filteredVectors.map(v => ({  
                id: v.id,  
                score: cosineSimilarity(vector, v.values),  
                metadata: v.metadata  
            }));  

            const sorted = similarities.sort((a, b) => b.score - a.score);  
            return { matches: sorted.slice(0, topK) };  
        }  
    };  
}  

async function initVectorDB() {  
    try {  
        const indexes = await pinecone.listIndexes();  
        const indexNames = Array.isArray(indexes) ? indexes.map((index: { name: any }) => index.name) : [];  

        if (!indexNames.includes(PINECONE_INDEX_NAME)) {  
            console.log("Creating new Pinecone index...");  
            await pinecone.createIndex({  
                name: PINECONE_INDEX_NAME,  
                dimension: 768,   
                metric: 'cosine',  
                spec: {  
                    serverless: {  
                        cloud: 'gcp',  
                        region: ''  
                    }  
                }  
            });  
            console.log(`Created new Pinecone index: ${PINECONE_INDEX_NAME} `);  

            await new Promise(resolve => setTimeout(resolve, 60000));  
        }  

        const index = pinecone.index(PINECONE_INDEX_NAME);  
        return index;  
    } catch (error) {  
        console.error("Error with Pinecone:", error);  
        console.log("Using fallback in-memory vector store...");  
        return createSimpleVectorStore();  
    }  
}  

function loadCSVNews(): Array<Article> {  
    try {  
        const csvPath = path.resolve(__dirname, './data/articles_dataset.csv')  
        const fileContent = readFileSync(csvPath)  

        const records = parse(fileContent, {  
            columns: true,  
            skip_empty_lines: true  
        })  

        return records  
            .filter((r: any) => r.title && r.url && r.date)  
            .map((r: any) => ({  
                title: r.title,  
                content: r.content || '',  
                url: r.url,  
                date: r.date  
            }))  
    } catch (error) {  
        console.error("Error loading CSV:", error);  
        return [];  
    }  
}  

async function ingestArticles(articles: Article[], index: any) {  
    console.log(`Ingesting ${articles.length} articles into vector database...`)  

    try {  
        const BATCH_SIZE = 10;  
        for (let i = 0; i < articles.length; i += BATCH_SIZE) {  
            const batch = articles.slice(i, i + BATCH_SIZE);  
            const vectors = [];  

            for (let j = 0; j < batch.length; j++) {  
                const article = batch[j];  
                try {  
                    const textForEmbedding = `Title: ${article.title} \nContent: ${article.content} `;  

                    const embedding = await getEmbeddings(textForEmbedding);  

                    vectors.push({  
                        id: `article - ${i + j} -${article.url.slice(-40).replace(/[^a-zA-Z0-9]/g, '-')} `,  
                        values: embedding,  
                        metadata: {  
                            title: article.title,  
                            content: article.content,  
                            url: article.url,  
                            date: article.date  
                        }  
                    });  
                } catch (embeddingError) {  
                    console.error(`Error embedding article ${j}: `, embeddingError);  
                }  
            }  

            if (vectors.length > 0) {  
                await index.upsert(vectors);  
                console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} ingested(${vectors.length} articles)`);  
            }  
        }  

        console.log('All articles ingested successfully');  
    } catch (error) {  
        console.error("Error during ingestion:", error);  
    }  

    return index;  
}  

async function searchRelevantArticles(query: string, index: any, maxResults: number = 3) {  
    try {  
        const queryEmbedding = await getEmbeddings(query);  

        const queryResponse = await index.query({  
            vector: queryEmbedding,  
            topK: maxResults,  
            includeMetadata: true  
        });  

        return queryResponse.matches.map((match: { metadata: { title: any; content: any; url: any; date: any }; score: any }) => ({  
            title: match.metadata.title,  
            content: match.metadata.content,  
            url: match.metadata.url,  
            date: match.metadata.date,  
            score: match.score  
        }));  
    } catch (error) {  
        console.error("Error searching articles:", error);  
        return [];  
    }  
}  

async function performRAGQuery(query: string, index: any): Promise<{ answer: string, sources: Source[] }> {  
    try {  
        const urlRegex = /(https?:\/\/[^\s]+)/g;  
        const urlMatch = query.match(urlRegex);  

        let relevantArticles = [];  

        if (urlMatch) {  
            const url = urlMatch[0];  

            try {  
                const dummyEmbedding = await getEmbeddings("dummy query for URL search");  

                const queryResponse = await index.query({  
                    vector: dummyEmbedding,  
                    filter: { url: { $eq: url } },  
                    topK: 1,  
                    includeMetadata: true  
                });  

                if (queryResponse.matches && queryResponse.matches.length > 0) {  
                    relevantArticles = queryResponse.matches.map((match: { metadata: { title: any; content: any; url: any; date: any } }) => ({  
                        title: match.metadata.title,  
                        content: match.metadata.content,  
                        url: match.metadata.url,  
                        date: match.metadata.date  
                    }));  
                } else {  
                    relevantArticles = await searchRelevantArticles(query, index);  
                }  
            } catch (error) {  
                console.error("Error searching by URL:", error);  
                relevantArticles = await searchRelevantArticles(query, index);  
            }  
        } else {  
            relevantArticles = await searchRelevantArticles(query, index);  
        }  

        if (relevantArticles.length === 0) {  
            return {  
                answer: "I couldn't find relevant information about your question in the available articles.",  
                sources: []  
            };  
        }  

        const context = relevantArticles.map((article: { title: any; content: any; url: any; date: any }) =>  
            `ARTICLE: ${article.title} \nCONTENT: ${article.content} \nURL: ${article.url} \nDATE: ${article.date} `  
        ).join('\n\n');  

        const structuredOutputFormat = `  
{  
    "answer": "Your detailed response to the query",  
    "reasoning": "Your step-by-step reasoning process"  
} `;  

        const prompt = `  
    You are a news assistant who provides accurate information based on articles in your database.  

    QUESTION: ${query}  
    
    RELEVANT ARTICLES:  
    ${context}  
    
    Based ONLY on the information from the articles above, answer the question. If the information is not present in the articles, say that you don't have this information.  
    
    Provide your answer in the following JSON format:  
    ${structuredOutputFormat}  
`;  

        const result = await textModel.generateContent(prompt);  
        const responseText = result.response.text();  

        let parsedResponse;  
        try {  
            const jsonMatch = responseText.match(/```(?: json) ?\s * ({ [\s\S]*?}) \s * ```/) ||  
                responseText.match(/{[\s\S]*?}/);  

            const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : responseText;  
            parsedResponse = JSON.parse(jsonStr);  
        } catch (e) {  
            console.error("Error parsing JSON response:", e);  
            parsedResponse = {  
                answer: responseText,  
                reasoning: "Failed to parse structured output"  
            };  
        }  

        const sources: Source[] = relevantArticles.map((article: { title: any; url: any; date: any }) => ({  
            title: article.title,  
            url: article.url,  
            date: article.date  
        }));  

        return {  
            answer: parsedResponse.answer,  
            sources  
        };  
    } catch (error) {  
        console.error("Error in RAG query:", error);  
        return {  
            answer: "An error occurred while processing your query. Please try again.",  
            sources: []  
        };  
    }  
}  

let vectorStore: any;  
(async () => {  
    try {  
        console.log("Initializing vector database...");  
        vectorStore = await initVectorDB();  

        console.log("Loading news articles from CSV...");  
        const articles = loadCSVNews();  

        if (articles.length > 0) {  
            console.log("Ingesting articles into vector store...");  
            await ingestArticles(articles, vectorStore);  
        } else {  
            console.log("No articles to ingest.");  
        }  

        console.log("Initialization complete!");  
    } catch (error) {  
        console.error("Error during initialization:", error);  
    }  
})();  

const resolvers = {  
    Mutation: {  
        askAgent: async (_: any, { query }: { query: string }) => {  
            if (!vectorStore) {  
                return {  
                    answer: "The system is still initializing. Please try again in a moment.",  
                    sources: []  
                };  
            }  

            try {  
                const response = await performRAGQuery(query, vectorStore);  
                return response;  
            } catch (error: any) {  
                console.error("Error generating content:", error);  
                return {  
                    answer: "An error occurred while processing your query. Please try again.",  
                    sources: []  
                };  
            }  
        }  
    },  
    Subscription: {  
        agentStream: {  
            subscribe: async function* (_: any, { query }: { query: string }) {  
                if (!vectorStore) {  
                    yield {  
                        answer: "The system is still initializing. Please try again in a moment.",  
                        sources: []  
                    };  
                    return;  
                }  

                try {  
                    const response = await performRAGQuery(query, vectorStore);  
                    yield response;  
                } catch (error: any) {  
                    console.error("Error in response streaming:", error);  
                    yield {  
                        answer: "An error occurred while processing your query. Please try again.",  
                        sources: []  
                    };  
                }  
            }  
        }  
    }  
};  

const schema = makeExecutableSchema({  
    typeDefs,  
    resolvers  
});  

const yoga = createYoga({  
    schema,  
    graphiql: true  
});  

const server = createServer(yoga);  

server.listen(4000, () => {  
    console.log('🚀 GraphQL Server running on http://localhost:4000/graphql');  
});  