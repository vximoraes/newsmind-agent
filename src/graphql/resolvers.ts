import { performRAGQuery } from '../services/ai'; 
import { vectorStore } from '../services/pinecone'; 

export const resolvers = {
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