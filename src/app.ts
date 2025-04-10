import express from 'express';
import { langfuseMiddleware } from './middlewares/langfuseMiddleware';
import { agentRoutes } from './routes/agentRoutes';
import { startGraphqlServer } from './graphql/server';  

const app = express();

app.use(express.json());
app.use(langfuseMiddleware);
app.use('/agents', agentRoutes);

app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

app.get('/test', (req, res) => {
    res.json({ message: 'Server is running' });
});

startGraphqlServer();

export { app };  