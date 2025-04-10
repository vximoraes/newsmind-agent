import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { Source } from '../types/Source';  

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
export const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
export const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });

export async function getEmbeddings(text: string): Promise<number[]> {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
}

export async function searchRelevantArticles(query: string, index: any, maxResults: number = 3) {
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

export async function performRAGQuery(query: string, index: any): Promise<{ answer: string, sources: Source[] }> {
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
            `ARTICLE: ${article.title}\nCONTENT: ${article.content}\nURL: ${article.url}\nDATE: ${article.date}`
        ).join('\n\n');

        const structuredOutputFormat = `  
{  
    "answer": "Your detailed response to the query",  
    "reasoning": "Your step-by-step reasoning process"  
}`;
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
            const jsonMatch = responseText.match(/```(?: json)?\s*({[\s\S]*?})\s*```/) ||
                responseText.match(/{[\s\S]*?}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
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