import { Router } from 'express';  
import { performRAGQuery } from '../services/ai';  
import { vectorStore } from '../services/pinecone';  
import type { Request, Response } from 'express';  
import { langfuseMiddleware } from '../middlewares/langfuseMiddleware';  

const router = Router();  

router.use(langfuseMiddleware);  

router.post('/agent', async (req: Request, res: Response): Promise<void> => {  
    const { query } = req.body;  
    if (!query) {  
        res.status(400).json({ error: "Field 'query' is required" });  
        return;  
    }  

    const generation = req.langfuseTrace  
        ? req.langfuseTrace.generation({  
            name: "chat-completion",  
            model: "gemini-1.5-flash",  
            modelParameters: {  
                temperature: 0.9,  
                maxTokens: 2000,  
            },  
            input: query,  
        })  
        : null;  

    try {  
        const response = await performRAGQuery(query, vectorStore);  
        if (generation) {  
            generation.end({ output: response.answer });  
        }  
        res.json({  
            answer: response.answer,  
            sources: response.sources,  
        });  
    } catch (error) {  
        console.error("Error processing /agent request:", error);  
        res.status(500).json({ error: "Internal server error" });  
    }  
});

export const agentRoutes = router;  