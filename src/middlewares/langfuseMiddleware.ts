import { NextFunction, Request, Response } from 'express';  
import { langfuse } from '../services/langfuse';  

declare global {  
    namespace Express {  
        interface Request {  
            langfuseTrace?: ReturnType<typeof langfuse.trace>;  
        }  
    }  
}  

export function langfuseMiddleware(req: Request, res: Response, next: NextFunction) {  
    if (req.body.query) {  
        req.langfuseTrace = langfuse.trace({  
            name: "my-AI-application-endpoint",  
        });  
    }  
    next();  
}  