import 'dotenv/config';  
import express from 'express';  
import { initVectorDB } from './services/pinecone';  
import { consumeKafka } from './services/kafka';  
import { agentRoutes } from './routes/agentRoutes';  
import { langfuseMiddleware } from './middlewares/langfuseMiddleware';  
import { startGraphqlServer } from './graphql/server';

const app = express();  
app.use(express.json());  
app.use(langfuseMiddleware);

app.use(agentRoutes);  

(async () => {  
    try {  
        console.log("Inicializando banco de dados vetorial...");  
        const vectorStoreInstance = await initVectorDB();  
        consumeKafka(vectorStoreInstance).catch(err => console.error("Erro no consumidor Kafka:", err));  
        console.log("Inicialização completa!");  
    } catch (error) {  
        console.error("Erro durante a inicialização:", error);  
    }  
})();  

const PORT = process.env.PORT || 3000;  
app.listen(PORT, () => {  
    console.log(`Servidor Express rodando em http://localhost:${PORT}`);  
});  

startGraphqlServer()